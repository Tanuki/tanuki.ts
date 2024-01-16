import FunctionModeler from '../functionModeler';
import { FunctionDescription } from '../models/functionDescription';
import { FunctionExample } from '../models/functionExample';
import LLMApi from './LLMApi';
import { approximateTokenCount } from '../utils';
import { Validator } from '../validator';
import { LanguageModelOutput } from "../models/languageModelOutput";
import { JSONSchema } from '../models/jsonSchema';

interface Model {
  tokenLimit: number;
  type: string;
}

export class LanguageModelManager {
  private apiProviders: Record<string, LLMApi>;
  private functionModeler: FunctionModeler;
  private instruction: string;
  private systemMessage: string;
  private repairInstruction: string;
  private generationLength: number;
  private models: Record<string, Model>; // Define the model structure as needed
  private instructionTokenCount: number;
  private systemMessageTokenCount: number;

  constructor(
    functionModeler: FunctionModeler,
    generationTokenLimit: number,
    apiProviders: Record<string, LLMApi>
  ) {
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
    validator: Validator
  ): Promise<any> {
    const output: LanguageModelOutput = await this.generate(
      args,
      functionDescription
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
          validator
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
      await this.getGenerationCase(args, functionDescription);

    let modelType: string;
    if (isDistilledModel) {
      modelType = this.getDistillationModelType(model);
    } else {
      modelType = this.getTeacherModelType(model);
    }

    const choice = this.synthesiseAnswer(
      prompt,
      model,
      modelType,
      llmParameters
    );

    return new LanguageModelOutput(
      await choice,
      saveToFinetune,
      isDistilledModel
    );
  }

  private async synthesiseAnswer(
    prompt: string,
    model: string,
    modelType: string,
    llmParameters: Record<string, any>
  ): Promise<string> {
    if (modelType === 'openai') {
      return await this.apiProviders[modelType].generate(
        model,
        this.systemMessage,
        prompt,
        llmParameters
      );
    } else {
      throw new Error(
        'Only OpenAI is supported currently. Please feel free to raise a PR to support development.'
      );
    }
  }

  private getDistillationModelType(model: string): string {
    // Currently only openai is supported
    return 'openai';
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
    functionDescription: FunctionDescription
  ): Promise<{
    prompt: string;
    model: string;
    saveToFinetune: boolean;
    isDistilledModel: boolean;
  }> {
    const f = JSON.stringify(functionDescription);

    const [distilledModel, teacherModels] =
      await this.functionModeler.getModels(functionDescription);
    const isDistilledModel = distilledModel !== '';
    const [suitableForDistillation, inputPromptTokenCount] =
      this.suitableForFinetuningTokenCheck(
        args,
        f,
        this.functionModeler.distillationTokenLimit
      );

    if (isDistilledModel && suitableForDistillation) {
      const prompt = this.constructPrompt(f, args, null);
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
        .join('\n');
      const prompt = this.constructPrompt(f, args, examples);
      const examplesTokenCount = approximateTokenCount(examples);
      const totalTokenCount =
        examplesTokenCount +
        inputPromptTokenCount +
        this.instructionTokenCount +
        this.systemMessageTokenCount;
      const model = this.chooseModelFromTokens(teacherModels, totalTokenCount);
      if (model) {
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
    distillationTokenCount: number
  ): [boolean, number] {
    const finetuningPrompt = `Function: ${f}\n---\nInputs:\nArgs: ${JSON.stringify(
      args
    )}\nOutput:`;
    const inputPromptTokenCount = approximateTokenCount(finetuningPrompt);
    const suitableForFinetune =
      inputPromptTokenCount +
        this.instructionTokenCount +
        this.systemMessageTokenCount <
      distillationTokenCount;
    return [suitableForFinetune, inputPromptTokenCount];
  }

  private constructPrompt(
    f: string,
    args: any,
    examples: string | null
  ): string {
    const exampleInput = examples ? `Examples:${examples}\n` : '';
    return `${
      this.instruction
    }\nFunction: ${f}\n${exampleInput}---\nInputs:\nArgs: ${JSON.stringify(
      args
    )}\nOutput:`;
  }

  private async repairGenerate(
    args: any[],
    f: string,
    failedOutputsList: Array<[string, string]>,
    examples: string,
    models: string[]
  ): Promise<string | null> {
    const prompt = this.generateRepairPrompt(
      args,
      f,
      failedOutputsList,
      examples
    );
    const promptTokenCount = approximateTokenCount(prompt);
    const model = this.chooseModelFromTokens(models, promptTokenCount);
    if (model) {
      const modelType = this.getTeacherModelType(model);
      return await this.synthesiseAnswer(prompt, model, modelType, {});
    } else {
      return null;
    }
  }
  private generateRepairPrompt(
    args: any,
    f: string,
    failedOutputsList: Array<[string, string]>,
    examples: string
  ): string {
    let failedExamples = '';
    for (const failedOutput of failedOutputsList) {
      failedExamples += `Output: ${failedOutput[0]}\nError: ${failedOutput[1]}\n\n`;
    }
    const successfulExamples = examples
      ? `Successful Examples:${examples}\n`
      : '';
    return `${
      this.repairInstruction
    }\nFUNCTION DESCRIPTION: ${f}\n${successfulExamples}---Inputs:\nArgs: ${JSON.stringify(
      args
    )}
    )}\nFAILED EXAMPLES: ${failedExamples}Correct output:`;
  }

  private chooseModelFromTokens(
    models: string[],
    tokenCount: number
  ): string | null {
    for (const model of models) {
      if (
        model in this.models &&
        tokenCount < this.models[model]['tokenLimit']
      ) {
        return model;
      }
    }
    return null;
  }

  public async repairOutput(
    args: any,
    functionDescription: FunctionDescription,
    choice: string,
    validator: Validator
  ): Promise<{ choice: string; choiceParsed: any; successfulRepair: boolean }> {
    const teacherModels: string[] = (
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
    const typeHint = <string>functionDescription.outputTypeDefinition;
    const error = `Output type was not valid. Expected a valid object of type ${typeHint}, got '${choice}'`;
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
          examples,
          teacherModels
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
