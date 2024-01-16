import { FinetuneJob } from './models/finetuneJob';
import LLMFinetuneAPI from './languageModels/LLMFinetuneAPI';
import { FunctionExample } from './models/functionExample';
import { IDatasetWorker } from './trackers/IDatasetWorker';
import { approximateTokenCount, decodeInt, encodeInt } from './utils';
import { FunctionDescription } from './models/functionDescription';
import { PatchConfig } from './models/patchConfig';
import { FunctionConfig } from './models/functionConfig';
import { EXAMPLE_ELEMENT_LIMIT } from './constants';
import functionModeler from "./functionModeler";
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
  private functionConfigs: Record<string, FunctionConfig>;
  private dataWorker: IDatasetWorker;
  private symbolicAlignBuffer: Record<string, any>;
  private embeddableAlignBuffer: Record<string, any>;
  private datasetSizes: Record<string, Record<string, number>>;
  private apiProviders: Record<string, LLMFinetuneAPI>;

  constructor(
    dataWorker: IDatasetWorker,
    apiProviders: Record<string, LLMFinetuneAPI> = {},
    //environmentId = 0
  ) {
    this.functionConfigs = {};
    this.dataWorker = dataWorker;
    this.distillationTokenLimit = 3000;
    this.symbolicAlignBuffer = {};
    this.embeddableAlignBuffer = {};
    this.datasetSizes = this.getDatasets();
    //FunctionModeler.environmentId = environmentId;
    FunctionModeler.checkFinetuneBlacklist = new Set<string>();
    FunctionModeler.executeFinetuneBlacklist = new Set<string>();
    FunctionModeler.storeDataBlacklist = new Set<string>();
    this.datasetSizes = {
      POSITIVE_EMBEDDABLE_ALIGNMENTS: {},
      NEGATIVE_EMBEDDABLE_ALIGNMENTS: {},
      SYMBOLIC_ALIGNMENTS: {},
      PATCHES: {},
    };
    this.symbolicAlignBuffer = {};
    this.embeddableAlignBuffer = {};
    this.apiProviders = apiProviders;
  }

  public static setConfig(functionHash: string, config: PatchConfig) {
    functionModeler.environmentId = config.environmentId ?? 0;

    if (config.ignoreFinetuning) {
      functionModeler.executeFinetuneBlacklist.add(functionHash);
    }
    if (config.ignoreFinetuneFetching) {
      functionModeler.checkFinetuneBlacklist.add(functionHash);
    }
    if (config.ignoreDataStorage) {
      functionModeler.storeDataBlacklist.add(functionHash);
    }
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
      this.saveContrastiveAlignmentPair(functionHash, parsedArgs, pair, false);
    });
  }

  private saveContrastiveAlignmentPair(
    functionHash: string,
    args: any[],
    //kwargs: Record<string, any>,
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
          'PATCHES',
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
        // Assuming exampleObj has properties args, kwargs, and output
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

  loadSymbolicAlignStatements(functionHash: string): void {
    if (functionModeler.storeDataBlacklist.has(functionHash)) {
      this.datasetSizes.SYMBOLIC_ALIGNMENTS[functionHash] = 0;
      this.symbolicAlignBuffer[functionHash] = new Uint8Array();
    } else if (!this.symbolicAlignBuffer[functionHash]) {
      const [datasetSize, alignDataset] = this.getDatasetInfo(
        "SYMBOLIC_ALIGNMENTS",
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
    example: any,
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
    if (defaultUsed && !functionModeler.checkFinetuneBlacklist.has(funcHash)) {
      const [finetuned, finetuneConfig] = await this.checkForFinetunes(
        functionDescription
      );
      if (finetuned) {
        this.functionConfigs[funcHash] = finetuneConfig;
      }
    } else {
      this.functionConfigs[funcHash] = config;
    }
    return this.functionConfigs[funcHash];
  }

  private async checkForFinetunes(
    functionDescription: FunctionDescription
  ): Promise<[boolean, FunctionConfig]> {
    const finetuneHash =
      functionDescription.hash('finetune') + encodeInt(functionModeler.environmentId);
    const finetunes: FinetuneJob[] = await this.apiProviders[
      'openai'
    ].listFinetuned(1000);

    for (const finetune of finetunes) {
      if (finetune.status === 'succeeded') {
        if (finetune.fineTunedModel === undefined) {
          throw new Error('Finetuned model is empty');
        }
        if (finetune.fineTunedModel.includes(finetuneHash)) {
          try {
            const config = this.constructConfigFromFinetune(
              finetuneHash,
              finetune
            );
            this.dataWorker.updateFunctionConfig(
              functionDescription.hash(),
              config
            );
            return [true, config];
          } catch (error) {
            console.error('Error constructing config from finetune:', error);
            return [
              false,
              {
                distilledModel: '',
                currentModelStats: {
                  trainedOnDatapoints: 0,
                  runningFaults: [],
                },
                lastTrainingRun: { trainedOnDatapoints: 0 },
                currentTrainingRun: {},
                teacherModels: ['gpt-4', 'gpt-4-32k'],
                nrOfTrainingRuns: 0,
              },
            ];
          }
        }
      }
    }

    return [
      false,
      {
        distilledModel: '',
        currentModelStats: { trainedOnDatapoints: 0, runningFaults: [] },
        lastTrainingRun: { trainedOnDatapoints: 0 },
        currentTrainingRun: {},
        teacherModels: ['gpt-4', 'gpt-4-32k'],
        nrOfTrainingRuns: 0,
      },
    ];
  }

  private constructConfigFromFinetune(
    finetuneHash: string,
    finetune: FinetuneJob
  ): FunctionConfig {
    const model = finetune.fineTunedModel || '';

    if (model === '') {
      throw new Error('Finetuned model is empty');
    }

    const finetuneHashEnd = model.indexOf(finetuneHash) + finetuneHash.length;
    const nextChar = model.charAt(finetuneHashEnd);
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
      teacherModels: ['gpt-4', 'gpt-4-32k'],
      nrOfTrainingRuns: nrOfTrainingRuns,
    };
  }

  async getModels(
    functionDescription: FunctionDescription
  ): Promise<[string, string[]]> {
    const funcHash = functionDescription.hash();
    let funcConfig: FunctionConfig;

    if (funcHash in this.functionConfigs) {
      funcConfig = this.functionConfigs[funcHash];
    } else {
      funcConfig = await this.loadFunctionConfig(funcHash, functionDescription);
    }

    let distilledModel = '';
    if (funcConfig.distilledModel) {
      distilledModel = funcConfig.distilledModel;
    } else if (
      funcConfig.currentModel &&
      !funcConfig.teacherModels.includes(funcConfig.currentModel)
    ) {
      distilledModel = funcConfig.currentModel;
    }

    return [distilledModel, funcConfig.teacherModels];
  }

  updateDatapointConfig(repaired: boolean, funcHash: string): void {
    try {
      const faultValue = repaired ? 1 : 0;
      const runningFaults: number[] =
        this.functionConfigs[funcHash].currentModelStats.runningFaults;

      runningFaults.push(faultValue);
      this.functionConfigs[funcHash].currentModelStats.runningFaults =
        runningFaults.slice(-100);

      if (runningFaults.slice(-10).reduce((a, b) => a + b, 0) / 10 > 0.5) {
        this.functionConfigs[funcHash].distilledModel = '';
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
      if (currentTrainingRun && 'job_id' in currentTrainingRun) {
        await this.checkFinetuningStatus(funcHash);
      } else if (this.checkFinetuningCondition(funcHash)) {
        await this.executeFinetuning(functionDescription, funcHash);
      }
    } catch (error) {
      console.error('Error checking for finetuning', error);
    }
  }

  private checkFinetuningCondition(funcHash: string): boolean {
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
    }

    return patchDatasetSize + alignDatasetSize > trainingThreshold;
  }

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
      'SYMBOLIC_ALIGNMENTS',
      funcHash,
      'dataset'
    ) as string;
    const patchDataset: string = this.getDatasetInfo(
      'PATCHES',
      funcHash,
      'dataset'
    ) as string;

    if (!alignDataset && !patchDataset) {
      return;
    }

    const dataset = (alignDataset + patchDataset)
      .replace(/\\n/g, '[SEP_TOKEN]')
      .split('\n')
      .map(x => x.replace('[SEP_TOKEN]', '\\n'))
      .filter(x => x !== '')
      .map(x => JSON.parse(x) as FunctionExample);

    const instruction = "You are given below a function description and input data. The function description of what the function must carry out can be found in the Function section, with input and output type hints. The input data can be found in Input section. Using the function description, apply the function to the Input and return a valid output type, that is acceptable by the outputClassDefinition and outputClassHint. Return null if you can't apply the function to the input or if the output is optional and the correct output is null.\nINCREDIBLY IMPORTANT: Only output a JSON-compatible string in the correct response format."

    // Construct finetuning dataset
    const finetuningDataset = dataset.map(x => {
      return ({
        messages: [
          {
            role: 'system',
            content: `You are a skillful and accurate language model, who applies a described function on input data. Make sure the function is applied accurately and correctly and the outputs follow the output type hints and are valid outputs given the output types.`
          },
          {
            role: 'user',
            content: `${instruction}\nFunction: ${functionString}---\nInputs:\nArgs: ${JSON.stringify(x.args)}\nOutput:`
          },
          {
            role: 'assistant',
            content: x.output !== null ? JSON.stringify(x.output) : 'None',
          }
        ]
      });
    });

    // Create a string representation of the dataset
    const datasetString = finetuningDataset
      .map(item => JSON.stringify(item))
      .join('\n');

    // Create the finetune hash
    const finetuneHash =
      functionDescription.hash('finetune') +
      encodeInt(functionModeler.environmentId) +
      encodeInt(this.functionConfigs[funcHash].nrOfTrainingRuns);

    try {
      const finetuningResponse: FinetuneJob = await this.apiProviders[
        'openai'
      ].finetune(datasetString, finetuneHash);
      this.functionConfigs[funcHash].currentTrainingRun = {
        jobId: finetuningResponse.id,
        trainedOnDatapoints: alignDataset.length + patchDataset.length,
        lastChecked: new Date().toISOString(),
      };

      // Update the config file
      this.updateConfigFile(funcHash);
    } catch (error) {
      console.error('Error executing finetuning', error);
    }
  }

  async checkFinetuningStatus(funcHash: string): Promise<void> {
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
        const response: FinetuneJob = await this.apiProviders[
          'openai'
        ].getFinetuned(jobId);
        this.functionConfigs[funcHash].currentTrainingRun.lastChecked =
          now.toISOString();

        if (['succeeded', 'failed'].includes(response.status)) {
          this.updateFinetuneConfig(response, funcHash, response.status);
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
    status: string
  ): void {
    const defaultTrainedOnDatapoints = 0; // Default value for trainedOnDatapoints

    if (status === 'failed') {
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

    this.updateConfigFile(funcHash);
  }
}
export default FunctionModeler;
