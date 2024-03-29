import { FinetuneJob } from './models/finetuneJob';
import { FunctionExample } from './models/functionExample';
import { IDatasetWorker } from './trackers/IDatasetWorker';
import { approximateTokenCount, decodeInt, encodeInt } from './utils';
import { FunctionDescription } from './models/functionDescription';
import { PatchConfig } from './models/patchConfig';
import { FunctionConfig } from './models/functionConfig';
import {
  DEFAULT_DISTILLED_MODEL_NAME,
  DEFAULT_EMBEDDING_MODELS,
  DEFAULT_STUDENT_MODELS,
  DEFAULT_TEACHER_MODELS,
  EXAMPLE_ELEMENT_LIMIT,
  OPENAI_PROVIDER,
  PATCHES,
  SYMBOLIC_ALIGNMENTS,
} from './constants';
import functionModeler from './functionModeler';
import { APIManager, Finetunable } from './APIManager';
import { BaseModelConfig } from './languageModels/llmConfigs/baseModelConfig';
import { FunctionType } from './models/functionType';
// Define an interface for the expected structure of FunctionExample data
interface FunctionExampleData {
  args: any[];
  kwargs: Record<string, any>;
  output: any;
}

export class FunctionModeler {
  public distillationTokenLimit: number;
  public static environmentId: number;
  public static checkFinetuneBlacklist: Set<string>;
  public static executeFinetuneBlacklist: Set<string>;
  public static storeDataBlacklist: Set<string>;
  public static startupLoggingChecker: Set<string>;
  static teacherModelsOverride: Record<string, BaseModelConfig[]>;

  private functionConfigs: Record<string, FunctionConfig>;
  private dataWorker: IDatasetWorker;
  private symbolicAlignBuffer: Record<string, Uint8Array>;
  private embeddableAlignBuffer: Record<string, Uint8Array>;
  private datasetSizes: Record<string, Record<string, number>>;
  private apiManager: APIManager;

  constructor(dataWorker: IDatasetWorker, apiManager: APIManager) {
    this.functionConfigs = {};
    this.dataWorker = dataWorker;
    this.distillationTokenLimit = 3000;
    this.symbolicAlignBuffer = {};
    this.embeddableAlignBuffer = {};
    this.datasetSizes = this.getDatasets();
    FunctionModeler.teacherModelsOverride = {};
    //FunctionModeler.environmentId = environmentId;
    FunctionModeler.checkFinetuneBlacklist = new Set<string>();
    FunctionModeler.executeFinetuneBlacklist = new Set<string>();
    FunctionModeler.storeDataBlacklist = new Set<string>();
    FunctionModeler.startupLoggingChecker = new Set<string>();

    this.datasetSizes = {
      POSITIVE_EMBEDDABLE_ALIGNMENTS: {},
      NEGATIVE_EMBEDDABLE_ALIGNMENTS: {},
      SYMBOLIC_ALIGNMENTS: {},
      PATCHES: {},
    };

    this.symbolicAlignBuffer = {};
    this.embeddableAlignBuffer = {};
    this.apiManager = apiManager;
  }

  static configureTeacherModels(
    teacherModels: (string | BaseModelConfig)[],
    funcHash: string,
    taskType: FunctionType
  ): void {
    if (!(funcHash in FunctionModeler.teacherModelsOverride)) {
      FunctionModeler.teacherModelsOverride[funcHash] = [];
    }

    const preconfiguredModels =
      taskType === FunctionType.EMBEDDABLE
        ? DEFAULT_EMBEDDING_MODELS
        : DEFAULT_TEACHER_MODELS;
    teacherModels.forEach(model => {
      let modelConfig: BaseModelConfig;

      if (typeof model === 'string') {
        if (!(model in preconfiguredModels)) {
          throw new Error(
            `Teacher model ${model} not supported by default. Please include it in the list in extended config format`
          );
        }
        // @ts-ignore
        modelConfig = preconfiguredModels[model];
      } else {
        modelConfig = model;
      }

      FunctionModeler.teacherModelsOverride[funcHash].push(modelConfig);

      if (modelConfig.provider !== OPENAI_PROVIDER) {
        if (!FunctionModeler.checkFinetuneBlacklist.has(funcHash)) {
          FunctionModeler.checkFinetuneBlacklist.add(funcHash);
        }
        if (!FunctionModeler.executeFinetuneBlacklist.has(funcHash)) {
          FunctionModeler.executeFinetuneBlacklist.add(funcHash);
        }
      }
    });
  }
  public static setConfig(
    functionDescription: FunctionDescription,
    config: PatchConfig
  ) {
    const functionHash = functionDescription.hash();
    functionModeler.environmentId = config.environmentId ?? 0;
    let message = `For ${functionDescription.name} [${functionHash}] the following configuration has been set:`;
    if (config.ignoreFinetuning) {
      functionModeler.executeFinetuneBlacklist.add(functionHash);
      message += '\n- [ ] Model distillation ';
    } else {
      message += '\n- [x] Model distillation ';
    }

    if (config.ignoreFinetuneFetching) {
      functionModeler.checkFinetuneBlacklist.add(functionHash);
      message += '\n- [ ] Use finetuned models';
    } else {
      message += '\n- [x] Use finetuned models';
    }
    if (config.ignoreDataStorage) {
      functionModeler.storeDataBlacklist.add(functionHash);
      message += '\n- [ ] Runs cached for distillation fine-tuning';
    } else {
      message += '\n- [x] Runs cached for distillation fine-tuning';
    }
    console.info(message);
  }
  private getDatasetInfo(
    datasetType: string,
    funcHash: string,
    type: 'length' | 'dataset' | 'both' = 'length'
  ): string | number | [number, string | null] | null {
    return this.dataWorker.loadDataset(datasetType, funcHash, type);
  }

  private getDatasets(): Record<string, any> {
    return this.dataWorker.loadExistingDatasets();
  }

  saveEmbeddableAlignStatements(
    functionHash: string,
    args: any[],
    //kwargs: Record<string, any>,
    positivePairs: Array<[any[], Record<string, any>]>,
    negativePairs: Array<[any[], Record<string, any>]>
  ): void {
    // Prepare args and kwargs for saving
    const parsedArgs = this.prepareObjectForSaving(args);

    try {
      // Prepare positive and negative pairs for saving
      const parsedPositivePairs = positivePairs.map(pair =>
        this.prepareObjectForSaving(pair)
      );
      const parsedNegativePairs = negativePairs.map(pair =>
        this.prepareObjectForSaving(pair)
      );

      // Save the contrastive pairs
      parsedPositivePairs.forEach(pair => {
        this.saveContrastiveAlignmentPair(functionHash, parsedArgs, pair, true);
      });
      parsedNegativePairs.forEach(pair => {
        this.saveContrastiveAlignmentPair(
          functionHash,
          parsedArgs,
          pair,
          false
        );
      });
    } catch (error) {
      console.error('Error saving embeddable alignments', error);
      throw error;
    }
  }

  private saveContrastiveAlignmentPair(
    functionHash: string,
    args: any[],
    pair: [any[], Record<string, any>],
    positive: boolean
  ): void {
    const example = new FunctionExample(args, pair);
    let successfullySaved = false;
    let newDatapoint = true;

    if (!functionModeler.storeDataBlacklist.has(functionHash)) {
      // Assuming dataWorker has a method to log embeddable align
      [successfullySaved, newDatapoint] = this.dataWorker.logEmbeddableAlign(
        functionHash,
        example,
        positive
      );
    }

    if (successfullySaved) {
      const alignmentType = positive
        ? 'POSITIVE_EMBEDDABLE_ALIGNMENTS'
        : 'NEGATIVE_EMBEDDABLE_ALIGNMENTS';
      this.datasetSizes[alignmentType][functionHash] =
        (this.datasetSizes[alignmentType][functionHash] || 0) + 1;
    }

    if (newDatapoint) {
      // Update align buffer
      if (!this.embeddableAlignBuffer[functionHash]) {
        this.embeddableAlignBuffer[functionHash] = new Uint8Array();
      }
      // Convert example to a string and encode to bytes, then append
      const exampleStr = JSON.stringify(example); // Assuming FunctionExample has a proper toJSON method
      const exampleBytes = new TextEncoder().encode(exampleStr + '\r\n');
      this.embeddableAlignBuffer[functionHash] = this.concatUint8Arrays(
        this.embeddableAlignBuffer[functionHash],
        exampleBytes
      );
    }
  }

  // Helper method to concatenate two Uint8Arrays
  private concatUint8Arrays(a: Uint8Array, b: Uint8Array): Uint8Array {
    const c = new Uint8Array(a.length + b.length);
    c.set(a, 0);
    c.set(b, a.length);
    return c;
  }

  private prepareObjectForSaving<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj)) as T;
  }

  saveSymbolicAlignStatements(
    functionHash: string,
    args: any[],
    output: any
  ): void {
    const parsedOutput = this.prepareObjectForSaving(output);
    const parsedArgs = this.prepareObjectForSaving(args);

    const example = new FunctionExample(parsedArgs, parsedOutput);

    let successfullySaved = false;
    let newDatapoint = true;

    if (!functionModeler.storeDataBlacklist.has(functionHash)) {
      [successfullySaved, newDatapoint] = this.dataWorker.logSymbolicAlign(
        functionHash,
        example
      );
    }

    if (successfullySaved) {
      this.datasetSizes.SYMBOLIC_ALIGNMENTS[functionHash] =
        (this.datasetSizes.SYMBOLIC_ALIGNMENTS[functionHash] || 0) + 1;
    }

    if (newDatapoint) {
      if (!this.symbolicAlignBuffer[functionHash]) {
        this.symbolicAlignBuffer[functionHash] = new Uint8Array();
      }
      const exampleStr = JSON.stringify(example); // Assuming FunctionExample has a proper toJSON method
      const exampleBytes = new TextEncoder().encode(exampleStr + '\r\n');
      this.symbolicAlignBuffer[functionHash] = this.concatUint8Arrays(
        this.symbolicAlignBuffer[functionHash],
        exampleBytes
      );
    }
  }

  saveSymbolicDatapoint(funcHash: string, example: FunctionExample): boolean {
    const writtenDatapoints = this.dataWorker.logSymbolicPatch(
      funcHash,
      example
    );
    Object.entries(writtenDatapoints).forEach(([hash, datapoints]) => {
      if (this.datasetSizes.PATCHES[hash] === -1) {
        this.datasetSizes.PATCHES[hash] = this.getDatasetInfo(
          PATCHES,
          hash,
          'length'
        ) as number;
      } else {
        this.datasetSizes.PATCHES[hash] += datapoints;
      }
    });

    return Object.keys(writtenDatapoints).length > 0;
  }

  getSymbolicAlignments(funcHash: string, max = 20): FunctionExample[] {
    if (!this.symbolicAlignBuffer[funcHash]) {
      return [];
    }
    const buffer = this.symbolicAlignBuffer[funcHash];
    return this.getExamplesFromAlignmentBuffer(buffer, max);
  }

  getEmbeddableAlignments(funcHash: string, max = 20): any[] {
    if (!this.embeddableAlignBuffer[funcHash]) {
      return [];
    }
    const buffer = this.embeddableAlignBuffer[funcHash];
    return this.getExamplesFromAlignmentBuffer(buffer, max);
  }

  private getExamplesFromAlignmentBuffer(
    buffer: Uint8Array,
    max = 20
  ): FunctionExample[] {
    const splitBuffer = new TextDecoder().decode(buffer).split('\n');
    const examples = [];
    const uniqueExamples = new Set<string>(); // To track unique examples based on a unique identifier
    let exampleElementLimit = EXAMPLE_ELEMENT_LIMIT; // Define this constant as per your application's needs

    for (const exampleStr of splitBuffer) {
      if (exampleStr.trim() === '') {
        continue;
      }

      const nrOfElements = approximateTokenCount(exampleStr);
      exampleElementLimit -= nrOfElements;
      if (exampleElementLimit < 0) {
        break;
      }

      try {
        const exampleObj = JSON.parse(exampleStr) as FunctionExampleData;

        // Define a unique identifier for the example, e.g., a combination of args and output
        const uniqueId = JSON.stringify({
          args: exampleObj.args,
          output: exampleObj.output,
        });
        if (uniqueExamples.has(uniqueId)) {
          continue; // Skip if this example is already encountered
        }
        uniqueExamples.add(uniqueId);

        // Assuming exampleObj has properties args, and output
        const example = new FunctionExample(exampleObj.args, exampleObj.output);

        examples.push(example);
      } catch (error) {
        // Handle parsing error or skip the malformed example
        console.error('Error parsing FunctionExample', error);
      }

      if (examples.length >= max) {
        break;
      }
    }

    return examples;
  }

  public loadSymbolicAlignStatements(functionHash: string): void {
    if (functionModeler.storeDataBlacklist.has(functionHash)) {
      this.datasetSizes.SYMBOLIC_ALIGNMENTS[functionHash] = 0;
      this.symbolicAlignBuffer[functionHash] = new Uint8Array();
    } else if (!this.symbolicAlignBuffer[functionHash]) {
      const [datasetSize, alignDataset] = this.getDatasetInfo(
        SYMBOLIC_ALIGNMENTS,
        functionHash,
        'both'
      ) as [number, string];
      if (alignDataset) {
        const buffer = Buffer.from(alignDataset, 'utf-8'); // Convert string to ArrayBuffer
        this.symbolicAlignBuffer[functionHash] = new Uint8Array(buffer);
      }
      this.datasetSizes.SYMBOLIC_ALIGNMENTS[functionHash] = datasetSize;
    }
  }

  async postprocessSymbolicDatapoint(
    funcHash: string,
    functionDescription: FunctionDescription,
    example: FunctionExample,
    repaired = true
  ): Promise<void> {
    try {
      if (!functionModeler.storeDataBlacklist.has(funcHash)) {
        const added = this.saveSymbolicDatapoint(funcHash, example);
        if (added) {
          this.updateDatapointConfig(repaired, funcHash);
        }
      }
    } catch (error) {
      console.error('Could not add datapoint to training data', error);
    }
    if (!functionModeler.executeFinetuneBlacklist.has(funcHash)) {
      await this.checkForFinetuning(functionDescription, funcHash);
    }
  }

  async loadFunctionConfig(
    funcHash: string,
    functionDescription: FunctionDescription
  ): Promise<FunctionConfig> {
    const [config, defaultUsed] = this.dataWorker.loadFunctionConfig(funcHash);
    const finetuneProvider: string = config.distilledModel.provider;
    if (defaultUsed && !FunctionModeler.checkFinetuneBlacklist.has(funcHash)) {
      const [finetuned, finetuneConfig] = await this.checkForFinetunes(
        functionDescription,
        finetuneProvider
      );
      if (finetuned) {
        this.functionConfigs[funcHash] = finetuneConfig;
      }
    }
    if (FunctionModeler.teacherModelsOverride[funcHash] !== undefined) {
      config.teacherModels = FunctionModeler.teacherModelsOverride[funcHash];
    }

    this.functionConfigs[funcHash] = config;
    return this.functionConfigs[funcHash];
  }

  private async checkForFinetunes(
    functionDescription: FunctionDescription,
    finetuneProvider: string
  ): Promise<[boolean, FunctionConfig]> {
    console.info(
      `Checking for finetunes for ${functionDescription.name} using ${finetuneProvider}`
    );
    const environmentId = encodeInt(functionModeler.environmentId) || '';
    const finetuneHash =
      functionDescription.hash('finetune') + environmentId.trim();
    const finetunes: FinetuneJob[] = await (
      (await this.apiManager.getProvider(finetuneProvider)) as Finetunable
    ).listFinetuned(1000);

    for (const finetune of finetunes) {
      if (finetune.status === 'succeeded') {
        if (finetune.fineTunedModel === undefined) {
          throw new Error('Finetuned model is empty');
        }
        if (finetune.fineTunedModel.modelName.includes(finetuneHash)) {
          try {
            const config = this.constructConfigFromFinetune(
              finetuneHash,
              finetune
            );
            this.dataWorker.updateFunctionConfig(
              functionDescription.hash(),
              config
            );
            console.info(
              `Found finetuned model for ${functionDescription.name} [${config.distilledModel.modelName}]`
            );
            return [true, config];
          } catch (error) {
            console.info(
              `Found finetuned model for ${functionDescription.name} [${finetune.fineTunedModel.modelName}] but could not load it`
            );
            return [
              false,
              {
                distilledModel:
                  DEFAULT_STUDENT_MODELS[DEFAULT_DISTILLED_MODEL_NAME],
                currentModelStats: {
                  trainedOnDatapoints: 0,
                  runningFaults: [],
                },
                lastTrainingRun: { trainedOnDatapoints: 0 },
                currentTrainingRun: {},
                teacherModels: [],
                nrOfTrainingRuns: 0,
              },
            ];
          }
        }
      }
    }

    console.info(`No finetuned model found for ${functionDescription.name}`);
    return [
      false,
      {
        distilledModel: DEFAULT_STUDENT_MODELS[DEFAULT_DISTILLED_MODEL_NAME],
        currentModelStats: {
          trainedOnDatapoints: 0,
          runningFaults: [],
        },
        lastTrainingRun: { trainedOnDatapoints: 0 },
        currentTrainingRun: {},
        teacherModels: [],
        nrOfTrainingRuns: 0,
      },
    ];
  }

  private constructConfigFromFinetune(
    finetuneHash: string,
    finetune: FinetuneJob
  ): FunctionConfig {
    const model = finetune.fineTunedModel;
    const finetuneHashEnd =
      model.modelName.indexOf(finetuneHash) + finetuneHash.length;
    const nextChar = model.modelName.charAt(finetuneHashEnd);
    const nrOfTrainingRuns = decodeInt(nextChar) + 1;
    const nrOfTrainingPoints = Math.pow(2, nrOfTrainingRuns - 1) * 200;

    return {
      distilledModel: model,
      currentModelStats: {
        trainedOnDatapoints: nrOfTrainingPoints,
        runningFaults: [],
      },
      lastTrainingRun: { trainedOnDatapoints: nrOfTrainingPoints },
      currentTrainingRun: {},
      teacherModels: [],
      nrOfTrainingRuns: nrOfTrainingRuns,
    };
  }

  async getModels(
    functionDescription: FunctionDescription
  ): Promise<[BaseModelConfig, BaseModelConfig[]]> {
    const funcHash = functionDescription.hash();
    let funcConfig: FunctionConfig;

    if (funcHash in this.functionConfigs) {
      funcConfig = this.functionConfigs[funcHash];
    } else {
      funcConfig = await this.loadFunctionConfig(funcHash, functionDescription);
    }
    return [funcConfig.distilledModel, funcConfig.teacherModels];
  }

  /**
   * Update the config to reflect the new datapoint in the training data
   * First adds 1 to the current datapoints
   * Then updates running faults depending if priority is True or not and takes last 100
   * Then checks the revert condition, i.e if last 10 datapoints are 50% faulty
   * Finally updates the config file
   * @param repaired
   * @param funcHash
   */
  updateDatapointConfig(repaired: boolean, funcHash: string): void {
    try {
      const faultValue = repaired ? 1 : 0;
      const runningFaults: number[] =
        this.functionConfigs[funcHash].currentModelStats.runningFaults;

      runningFaults.push(faultValue);
      this.functionConfigs[funcHash].currentModelStats.runningFaults =
        runningFaults.slice(-100);

      if (runningFaults.slice(-10).reduce((a, b) => a + b, 0) / 10 > 0.5) {
        this.functionConfigs[funcHash].distilledModel.modelName = '';
        this.functionConfigs[
          funcHash
        ].currentModelStats.trainedOnDatapoints = 0;
        this.functionConfigs[funcHash].currentModelStats.runningFaults = [];
      }

      this.updateConfigFile(funcHash);
    } catch (error) {
      console.error('Could not update config file', error);
    }
  }

  private updateConfigFile(funcHash: string): void {
    this.dataWorker.updateFunctionConfig(
      funcHash,
      this.functionConfigs[funcHash]
    );
  }

  async checkForFinetuning(
    functionDescription: FunctionDescription,
    funcHash: string
  ): Promise<void> {
    try {
      const currentTrainingRun =
        this.functionConfigs[funcHash]?.currentTrainingRun;
      if (currentTrainingRun && currentTrainingRun.jobId !== undefined) {
        await this.checkFinetuningStatus(funcHash, functionDescription);
      } else if (this.checkFinetuningCondition(funcHash, functionDescription)) {
        await this.executeFinetuning(functionDescription, funcHash);
      }
    } catch (error) {
      console.error('Error checking for finetuning', error);
    }
  }

  private checkFinetuningCondition(
    funcHash: string,
    functionDescription: FunctionDescription
  ): boolean {
    if (!(funcHash in this.functionConfigs)) {
      return false;
    }

    const trainingThreshold =
      Math.pow(2, this.functionConfigs[funcHash].nrOfTrainingRuns) * 200;
    const alignDatasetSize =
      this.datasetSizes.SYMBOLIC_ALIGNMENTS[funcHash] || 0;
    let patchDatasetSize = this.datasetSizes.PATCHES[funcHash] || 0;

    if (patchDatasetSize === -1) {
      patchDatasetSize = this.getDatasetInfo(
        'PATCHES',
        funcHash,
        'length'
      ) as number;
      this.datasetSizes.PATCHES[funcHash] = patchDatasetSize;
      if (!FunctionModeler.startupLoggingChecker.has(funcHash)) {
        console.info(
          `Function ${functionDescription.name} [${alignDatasetSize} aligns | ${patchDatasetSize} runs] will be finetuned from` +
            ` ${this.functionConfigs[funcHash].teacherModels[0].modelName} using ${this.functionConfigs[funcHash].distilledModel.provider} in` +
            `${trainingThreshold - (patchDatasetSize + alignDatasetSize)} runs`
        );
        FunctionModeler.startupLoggingChecker.add(funcHash);
      }
    }

    return patchDatasetSize + alignDatasetSize > trainingThreshold;
  }

  /**
   * Execute the finetuning
   * First create the OpenAI compatible dataset with jsonL file and upload it
   * Then submit the OpenAI finetuning job
   * Finally update the config file to reflect the new finetuning job as current
   * @param functionDescription
   * @param funcHash
   */
  async executeFinetuning(
    functionDescription: FunctionDescription,
    funcHash: string
  ): Promise<void> {
    /**
    Execute the finetuning
    First create the OpenAI compatible dataset with jsonL file and upload it
    Then submit the OpenAI finetuning job
    Finally update the config file to reflect the new finetuning job as current
    **/

    const functionString = JSON.stringify(functionDescription);

    const alignDataset: string = this.getDatasetInfo(
      SYMBOLIC_ALIGNMENTS,
      funcHash,
      'dataset'
    ) as string;
    const patchDataset: string = this.getDatasetInfo(
      PATCHES,
      funcHash,
      'dataset'
    ) as string;

    if (!alignDataset && !patchDataset) {
      return;
    }

    const datasetStrings = (alignDataset + patchDataset)
      .replace(/\\n/g, '[SEP_TOKEN]')
      .split('\n')
      .map(x => x.replace('[SEP_TOKEN]', '\\n'))
      .filter(x => x !== '');

    const dataset = datasetStrings.map(x => JSON.parse(x) as FunctionExample);

    const instruction =
      "You are given below a function description and input data. The function description of what the function must carry out can be found in the Function section, with input and output type hints. The input data can be found in Input section. Using the function description, apply the function to the Input and return a valid output type, that is acceptable by the outputClassDefinition and outputClassHint. Return null if you can't apply the function to the input or if the output is optional and the correct output is null.\nINCREDIBLY IMPORTANT: Only output a JSON-compatible string in the correct response format.";

    // Construct finetuning dataset
    const finetuningDataset = dataset.map(x => {
      return {
        messages: [
          {
            role: 'system',
            content:
              'You are a skillful and accurate language model, who applies a described function on input data. Make sure the function is applied accurately and correctly and the outputs follow the output type hints and are valid outputs given the output types.',
          },
          {
            role: 'user',
            content: `${instruction}\nFunction: ${functionString}---\nInputs:\nArgs: ${JSON.stringify(
              x.args
            )}\nOutput:`,
          },
          {
            role: 'assistant',
            content: x.output !== null ? JSON.stringify(x.output) : 'None',
          },
        ],
      };
    });

    // Create a string representation of the dataset
    const datasetString = finetuningDataset
      .map(item => JSON.stringify(item))
      .join('\n');

    // Create the finetune hash
    let finetuneHash =
      functionDescription.hash('finetune') +
      encodeInt(functionModeler.environmentId) +
      encodeInt(this.functionConfigs[funcHash].nrOfTrainingRuns);

    const nrOfTrainingRuns = this.functionConfigs[funcHash].nrOfTrainingRuns;
    finetuneHash += encodeInt(FunctionModeler.environmentId);
    finetuneHash += encodeInt(nrOfTrainingRuns);

    const alignDatasetSize =
      this.datasetSizes.SYMBOLIC_ALIGNMENTS[funcHash] || 0;
    const patchDatasetSize = this.datasetSizes.PATCHES[funcHash] || 0;
    const totalDatasetSize = alignDatasetSize + patchDatasetSize;

    const datasetBuffer = Buffer.from(datasetString, 'utf-8');
    const finetuneProvider =
      this.functionConfigs[funcHash].distilledModel.provider;

    // @ts-ignore
    try {
      console.info(
        `Starting finetuning for ${functionDescription.name} using ${finetuneProvider}`
      );
      const provider = (await this.apiManager.getProvider(
        finetuneProvider
      )) as Finetunable;
      const finetuningResponse: FinetuneJob = await provider.finetune(
        datasetBuffer,
        finetuneHash
      );

      this.functionConfigs[funcHash].currentTrainingRun = {
        jobId: finetuningResponse.id,
        trainedOnDatapoints: totalDatasetSize,
        lastChecked: new Date().toISOString(),
      };

      // Update the config file
      this.updateConfigFile(funcHash);
    } catch (error: any) {
      console.error(
        `Could not start finetuning for ${
          functionDescription.name
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        } using ${finetuneProvider}. Error: ${error.toString()}`
      );
    }
  }

  async checkFinetuningStatus(
    funcHash: string,
    functionDescription: FunctionDescription
  ): Promise<void> {
    const currentTrainingRun =
      this.functionConfigs[funcHash]?.currentTrainingRun;
    if (!currentTrainingRun) return;

    const { jobId, lastChecked } = currentTrainingRun;
    const lastCheckedDate = lastChecked ? new Date(lastChecked) : new Date();
    const now = new Date();

    // Check if 30 minutes have passed since lastChecked
    if (
      now.getTime() - lastCheckedDate.getTime() > 1800000 &&
      jobId !== undefined
    ) {
      try {
        const finetuneProvider =
          this.functionConfigs[funcHash].distilledModel.provider;
        const provider = (await this.apiManager.getProvider(
          finetuneProvider
        )) as Finetunable;
        const response: FinetuneJob = await provider.getFinetuned(jobId);
        this.functionConfigs[funcHash].currentTrainingRun.lastChecked =
          now.toISOString();

        if (['succeeded', 'failed'].includes(response.status)) {
          this.updateFinetuneConfig(response, funcHash, functionDescription);
        } else {
          this.updateConfigFile(funcHash);
        }
      } catch (error) {
        console.error('Error checking finetuning status', error);
      }
    }
  }

  private updateFinetuneConfig(
    response: FinetuneJob,
    funcHash: string,
    functionDescription: FunctionDescription
  ): void {
    const defaultTrainedOnDatapoints = 0; // Default value for trainedOnDatapoints
    if (response.status === 'failed') {
      this.functionConfigs[funcHash].currentTrainingRun = {};
    } else {
      this.functionConfigs[funcHash].distilledModel =
        response.fineTunedModel ?? '';

      const trainedOnDatapoints =
        this.functionConfigs[funcHash].currentTrainingRun.trainedOnDatapoints ??
        defaultTrainedOnDatapoints;
      this.functionConfigs[funcHash].lastTrainingRun = {
        trainedOnDatapoints: trainedOnDatapoints,
      };
      //this.functionConfigs[funcHash].lastTrainingRun = { ...this.functionConfigs[funcHash].currentTrainingRun };
      this.functionConfigs[funcHash].currentModelStats = {
        trainedOnDatapoints: trainedOnDatapoints,
        runningFaults: [],
      };
      this.functionConfigs[funcHash].nrOfTrainingRuns++;
      this.functionConfigs[funcHash].currentTrainingRun = {};
    }
    console.info(
      `Finetuning for ${functionDescription.name} using ${this.functionConfigs[funcHash].distilledModel.provider} finished with status: ${response.status}`
    );
    try {
      this.updateConfigFile(funcHash);
    } catch (err: any) {
      console.error(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `Could not update the function configuration file with the finetuned model for ${functionDescription.name}. Error: ${err.message}`
      );
    }
  }
}
export default FunctionModeler;
