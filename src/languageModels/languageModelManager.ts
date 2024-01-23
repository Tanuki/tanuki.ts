import FunctionModeler from '../functionModeler';
import { FunctionDescription } from '../models/functionDescription';
import { FunctionExample } from '../models/functionExample';
import LLMApi from './LLMApi';
import { approximateTokenCount } from '../utils';
import { Validator } from '../validator';
import { LanguageModelOutput } from "../models/languageModelOutput";
import { JSONSchema } from '../models/jsonSchema';
import { BaseModelConfig } from "./llmConfigs/baseModelConfig";
import { APIManager } from "../APIManager";

interface Model {
  tokenLimit: number;
  type: string;
}

export class LanguageModelManager {
  private apiProviders: APIManager;
  private functionModeler: FunctionModeler;
  private instruction: string;
  private systemMessage: string;
  private repairInstruction: string;
  private generationLength: number;
  private models: Record<string, Model>; // Define the model structure as needed
  private instructionTokenCount: number;
  private systemMessageTokenCount: number;
  private currentGenerators: Map<string, any>;
  private defaultGenerationLength: number;

  constructor(
    functionModeler: FunctionModeler,
    generationTokenLimit: number,
    apiProviders: APIManager
  ) {
    this.defaultGenerationLength = generationTokenLimit
    this.currentGenerators = new Map<string, any>();
    this.apiProviders = apiProviders;
    this.functionModeler = functionModeler;
    this.instruction =
      "You are given below a function description and input data. The function description of what the function must carry out can be found in the Function section, with input and output type hints. The input data can be found in Input section. Using the function description, apply the function to the Input and return a valid output type, that is acceptable by the output_class_definition and output_class_hint. Return null if you can't apply the function to the input or if the output is optional and the correct output is null.\nINCREDIBLY IMPORTANT: Only output a JSON-compatible string in the correct response format.";
    this.systemMessage =
      'You are a skillful and accurate language model, who applies a described function on input data. Make sure the function is applied accurately and correctly and the outputs follow the output type hints and are valid outputs given the output types.';

    // Assuming approximateTokenCount is a function that calculates the token count
    this.instructionTokenCount = approximateTokenCount(this.instruction);
    this.systemMessageTokenCount = approximateTokenCount(this.systemMessage);
    this.repairInstruction =
      "Below are outputs of a function applied to inputs, which failed type validation. The input to the function is brought out in the INPUT section and function description is brought out in the FUNCTION DESCRIPTION section. Your task is to apply the function to the input and return a correct output in the right type. The FAILED EXAMPLES section will show previous outputs of this function applied to the data, which failed type validation and hence are wrong outputs. Using the input and function description output the accurate output following the output_class_definition and output_type_hint attributes of the function description, which define the output type. Make sure the output is an accurate function output and in the correct type. Return null if you can't apply the function to the input or if the output is optional and the correct output is null.";
    this.generationLength = generationTokenLimit;
    this.models = {
      'gpt-4-1106-preview': {
        tokenLimit: 128000 - this.generationLength,
        type: 'openai',
      },
      'gpt-4': {
        tokenLimit: 8192 - this.generationLength,
        type: 'openai',
      },
      'gpt-4-32k': {
        tokenLimit: 32768 - this.generationLength,
        type: 'openai',
      },
    };
  }

  public async call(
    args: any,
    functionDescription: FunctionDescription,
    validator: Validator,
    generationParameters: Record<string, any> = {}
  ): Promise<any> {

    if (generationParameters['max_new_tokens'] === undefined) {
      generationParameters['max_new_tokens'] = this.defaultGenerationLength;
    }
    const output: LanguageModelOutput = await this.generate(
      args,
      functionDescription,
      generationParameters
    );

    const choiceParsed = this.parseChoice(output);
    const isValid = validator.checkType(
      choiceParsed,
      <JSONSchema>functionDescription.outputTypeSchema
    );

    if (!isValid) {
      const { choice, choiceParsed, successfulRepair } =
        await this.repairOutput(
          args,
          functionDescription,
          output.generatedResponse,
          validator,
          generationParameters
        );

      if (!successfulRepair) {
        const typeString = functionDescription.outputTypeDefinition ?? "null";
        throw new TypeError(
          `Output type was not valid. Expected an object of type ${typeString}, got '${output.generatedResponse}'`
        );
      }

      output.generatedResponse = choice;
      output.distilledModel = false;
    }

    const datapoint: FunctionExample = new FunctionExample(
      args,
      output.generatedResponse
    );

    if (output.suitableForFinetuning && !output.distilledModel) {
      await this.functionModeler.postprocessSymbolicDatapoint(
        functionDescription.hash(),
        functionDescription,
        datapoint,
        !isValid
      );
    }

    /*return validator.instantiate(
      functionDescription.outputTypeDefinition,
      choiceParsed
    )*/
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return choiceParsed ;
  }

  private parseChoice(output: LanguageModelOutput): any {
    try {
      // Attempt to parse as JSON
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return JSON.parse(output.generatedResponse);
    } catch (error) {
      // If parsing fails, return the original response
      return output.generatedResponse;
    }
  }

  private async generate(
    args: any,
    functionDescription: FunctionDescription,
    llmParameters: Record<string, any> = {}
  ): Promise<LanguageModelOutput> {
    const { prompt, model, saveToFinetune, isDistilledModel } =
      await this.getGenerationCase(args, functionDescription, llmParameters);

    const funcHash = functionDescription.hash();

    if (!this.currentGenerators.has(funcHash)) {
      console.log(`Generating function outputs with ${model.modelName}`);
      this.currentGenerators.set(funcHash, model.modelName);
    } else if (this.currentGenerators.get(funcHash) !== model.modelName) {
      console.info(`Switching to ${model.modelName} for function outputs generation`);
      this.currentGenerators.set(funcHash, model.modelName);
    }

    const choice = await this.synthesiseAnswer(
      prompt,
      model,
      llmParameters
    );

    return new LanguageModelOutput(
      choice.trim(),
      saveToFinetune,
      isDistilledModel
    );
  }

  private async synthesiseAnswer(
    prompt: string,
    model: BaseModelConfig,
    llmParameters: Record<string, any>
  ): Promise<string> {
      const systemMessage = model.systemMessage;
      // @ts-ignore
    return await (await this.apiProviders.getProvider(model.provider)).generate(
        model,
        systemMessage,
        prompt,
        llmParameters
      );
  }

  private getTeacherModelType(model: string): string {
    if (Object.keys(this.models).includes(model)) {
      return this.models[model].type;
    } else {
      throw new Error('This teacher model is not supported.');
    }
  }

  private async getGenerationCase(
    args: any,
    functionDescription: FunctionDescription,
    llmParameters: Record<string, any> = {}
  ): Promise<{
    prompt: string;
    model: BaseModelConfig;
    saveToFinetune: boolean;
    isDistilledModel: boolean;
  }> {
    const f = JSON.stringify(functionDescription);

    const [distilledModel, teacherModels] =
      await this.functionModeler.getModels(functionDescription);
    const isDistilledModel = distilledModel.modelName !== '';
    const [suitableForDistillation, inputPromptTokenCount] =
      this.suitableForFinetuningTokenCheck(
        args,
        f,
        distilledModel
      );

    if (isDistilledModel && suitableForDistillation) {
      const prompt = this.constructPrompt(f, args, [], distilledModel);
      return {
        prompt,
        model: distilledModel,
        saveToFinetune: suitableForDistillation,
        isDistilledModel: true,
      };
    } else {
      const aligns: FunctionExample[] =
        this.functionModeler.getSymbolicAlignments(
          functionDescription.hash(),
          16
        );
      const examples = aligns
        .map(
          align =>
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/restrict-template-expressions
            `Inputs:\nArgs: ${align.args.toString()}\nOutput: ${align.output.toString()}`
        )
      const examplesTokenCount = examples.map(example => approximateTokenCount(example)).reduce((sum, current) => sum + current, 0);
      const generationTokens = llmParameters['max_new_tokens'] ?? this.defaultGenerationLength;
      const totalTokenCount =
        examplesTokenCount +
        inputPromptTokenCount +
        generationTokens;

      const model = this.chooseModelFromTokens(teacherModels, totalTokenCount, examples.length);

      if (model) {
        const prompt = this.constructPrompt(f, args, examples, model);

        return {
          prompt,
          model,
          saveToFinetune: suitableForDistillation,
          isDistilledModel: false,
        };
      } else {
        throw new Error(
          'The input content and align statements combined are too long.'
        );
      }
    }
  }

  private suitableForFinetuningTokenCheck(
    args: any,
    f: string,
    distilledModel: BaseModelConfig
  ): [boolean, number] {
    const finetuningPrompt = `Function: ${f}\n---\nInputs:\nArgs: ${JSON.stringify(
      args
    )}\nOutput:`;
    const inputPromptTokenCount = approximateTokenCount(finetuningPrompt);
    if (distilledModel.systemMessageTokenCount < 0) {
      distilledModel.systemMessageTokenCount = approximateTokenCount(distilledModel.systemMessage);
    }
    if (distilledModel.instructionTokenCount < 0) {
      distilledModel.instructionTokenCount = approximateTokenCount(distilledModel.instructions);
    }
    const suitableForFinetune =
      inputPromptTokenCount +
        distilledModel.instructionTokenCount +
        distilledModel.systemMessageTokenCount <
      distilledModel.contextLength;
    return [suitableForFinetune, inputPromptTokenCount];
  }

  /**
   * Construct a prompt given the model, function description, args, kwargs and examples
   * @private
   * @param f - The function description
   * @param args - The args of the function
   * @param examples - The examples of the function
   * @param model - The model to use for generation
   */
  private constructPrompt(
    f: string,
    args: any,
    examples: string[] | null,
    model: BaseModelConfig
  ): string {
    let exampleInput = '';
    if (examples && model.parsingHelperTokens) {
      const finalExamples = examples.map(example =>
        `${model.parsingHelperTokens.startToken}${example}${model.parsingHelperTokens.endToken}`
      ).join('\n');
      exampleInput = `Examples:${finalExamples}\n`;
    }

    const instructionPrompt = model.instructions;
    const argsString = JSON.stringify(args);
    const inputToken = model.parsingHelperTokens ? model.parsingHelperTokens.startToken : '';

    return `${instructionPrompt}\nFunction: ${f}\n${exampleInput}---\n${inputToken}Inputs:\nArgs: ${argsString}\nOutput:`;
  }

  /**
   * Repair the output given the input, function description, failed outputs list, examples and models
   * @private
   */
  private async repairGenerate(
    args: any[],
    f: string,
    failedOutputsList: Array<[string, string]>,
    aligns: FunctionExample[],
    models: BaseModelConfig[],
    generationParameters: Record<string, any> = {}
  ): Promise<string | null> {
    const examples = aligns
      .map(
        align =>
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/restrict-template-expressions
          `Inputs:\nArgs: ${align.args.toString()}\nOutput: ${align.output.toString()}`
      )
    const examplesTokenCount = examples.map(example => approximateTokenCount(example)).reduce((sum, current) => sum + current, 0);
    const failedExamplesTokenCount = failedOutputsList.map(failedExample => approximateTokenCount(failedExample[0]) + approximateTokenCount(failedExample[1])).reduce((sum, current) => sum + current, 0);
    const inputPromptTokenCount = approximateTokenCount(`"Function: ${f}\n---\nInputs:\nArgs: ${args}\nOutput:"`);
    const generationTokens = generationParameters['max_new_tokens'] ?? this.defaultGenerationLength;

    const model = this.chooseModelFromTokens(models, examplesTokenCount+failedExamplesTokenCount+inputPromptTokenCount+generationTokens, examples.length);
    if (model) {
      const prompt = this.generateRepairPrompt(
        args,
        f,
        failedOutputsList,
        examples,
        model
      );
      console.info(`Previous output failed type validation, attempting to repair with ${model.modelName}`)
      const output = await this.synthesiseAnswer(prompt, model, generationParameters);
      return output
    } else {
      return null;
    }
  }
  private generateRepairPrompt(
    args: any,
    f: string,
    failedOutputsList: Array<[string, string]>,
    examples: string[],
    model: BaseModelConfig
  ): string {
    let successfulExamples = ""
    if (examples.length > 0) {
      const finalExamples = examples.map(align => `${model.parsingHelperTokens.startToken}${align}${model.parsingHelperTokens.endToken}` ).join('\n');
      successfulExamples = `Examples:${finalExamples}\n`;
    }
    let failedExamples = '';
    for (const failedOutput of failedOutputsList) {
      failedExamples += `Output: ${failedOutput[0]}\nError: ${failedOutput[1]}\n\n`;
    }
    let endTokenAddition = ""
    if (model.parsingHelperTokens.endToken) {
      endTokenAddition = `Make sure to add the ${model.parsingHelperTokens.endToken} token at the end of the output.`
    }
    const prompt = `${model.repairInstruction}${endTokenAddition}\nFUNCTION DESCRIPTION: ${f}\n${successfulExamples}---${model.parsingHelperTokens.startToken}\nInputs:\nArgs: ${JSON.stringify(args)}\nFAILED EXAMPLES: ${failedExamples}Correct output:`;
    return prompt
  }

  /**
   * Choose a model from the models given the token count and number of examples
   * @param models - The models to choose from
   * @param inputTokenCount - The token count of the input
   * @param nrOfExamples - The number of examples
   * @private
   */
  chooseModelFromTokens(models: BaseModelConfig[], inputTokenCount: number, nrOfExamples = 0): BaseModelConfig | null {
    for (const model of models) {
      if (model.systemMessageTokenCount < 0) {
        model.systemMessageTokenCount = approximateTokenCount(model.systemMessage);
      }
      if (model.instructionTokenCount < 0) {
        model.instructionTokenCount = approximateTokenCount(model.instructions);
      }
      if (model.parsingHelperTokens.startToken) {
        inputTokenCount += 2 * nrOfExamples;
      }
      if (model.parsingHelperTokens.endToken) {
        inputTokenCount += 2 * nrOfExamples;
      }

      const totalTokenCount = inputTokenCount + model.instructionTokenCount + model.systemMessageTokenCount;
      if (totalTokenCount < model.contextLength) {
        return model;
      }
    }

    return null;
  }

  /**
   * Repair an output, that failed type validation by generating a new output using the teacher model and the error
   * @param args - The args of the function
   * @param functionDescription - The function description
   * @param choice - The output that failed type validation, type is arbitrary
   * @param validator - The validator object
   * @param generationParameters - The parameters used for generation (i.e temp)
   */
  public async repairOutput(
    args: any,
    functionDescription: FunctionDescription,
    choice: string,
    validator: Validator,
    generationParameters: Record<string, any> = {}
  ): Promise<{ choice: string; choiceParsed: any; successfulRepair: boolean }> {
    const teacherModels: BaseModelConfig[] = (
      await this.functionModeler.getModels(functionDescription)
    )[1];

    if (teacherModels.length === 0) {
      throw new Error(
        'No teacher models available for this function.'
      );
    }
    let valid = false;
    let retryIndex = 5;
    const f = JSON.stringify(functionDescription);
    const typeHint = JSON.stringify(functionDescription.outputTypeSchema);
    const error = `Output type was not valid. Expected a valid object of type ${typeHint}, got \`${choice}\``;
    const failedOutputsList: [string, string][] = [[choice, error]];
    let choiceParsed: any;

    while (retryIndex > 0 && !valid) {
      const aligns: FunctionExample[] =
        this.functionModeler.getSymbolicAlignments(
          functionDescription.hash(),
          5
        );
      const examples = aligns
        .map(
          align =>
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/restrict-template-expressions
            `Inputs:\nArgs: ${align.args.toString()}\nOutput: ${align.output.toString()}`
        )
        .join('\n');
      choice =
        (await this.repairGenerate(
          args,
          f,
          failedOutputsList,
          aligns,
          teacherModels,
          generationParameters
        )) ?? choice;
      if (!choice) {
        retryIndex--;
        continue;
      }

      try {
        choiceParsed = JSON.parse(choice);
      } catch {
        try {
          choiceParsed = eval(choice);
        } catch {
          choiceParsed = choice;
        }
      }

      valid = validator.checkType(
        choiceParsed,
        <JSONSchema>functionDescription.outputTypeSchema
      );
      if (!valid) {
        const error = `Output type was not valid. Expected an object of type ${<string>functionDescription.outputTypeDefinition}, got '${choice}'`;
        failedOutputsList.push([choice, error]);
        retryIndex--;
      }
    }

    const successfulRepair = valid;
    return { choice, choiceParsed, successfulRepair };
  }
}
