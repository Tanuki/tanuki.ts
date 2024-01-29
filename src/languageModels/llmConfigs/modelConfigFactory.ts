import {
  DEFAULT_DISTILLED_MODEL_NAME,
  DEFAULT_TEACHER_MODELS, DISTILLED_MODEL,
  LLAMA_BEDROCK_PROVIDER,
  OPENAI_PROVIDER, TEACHER_MODEL,
  DEFAULT_STUDENT_MODELS,
  TITAN_BEDROCK_PROVIDER
} from "../../constants";
import { LlamaBedrockConfig } from "./llamaConfig";
import { OpenAIConfig } from "./openAIConfig";
import { TitanBedrockConfig } from "./titanConfig";
import { BaseModelConfig } from "./baseModelConfig";
import { FunctionConfig } from "../../models/functionConfig";

interface ModelConfigInput {
  modelName: string;
  provider: string;
  contextLength: number;
  // Include other required fields here
  [key: string]: any; // This allows for additional dynamic properties
}

export class ModelConfigFactory {
  public static loadFunctionConfigFromDict(jsonObject: any): FunctionConfig {
    const distilledModel = ModelConfigFactory.createConfig(jsonObject.distilledModel, DISTILLED_MODEL) as BaseModelConfig;
    const currentModelStats = jsonObject.currentModelStats;
    const lastTrainingRun = jsonObject.lastTrainingRun;
    const currentTrainingRun = jsonObject.currentTrainingRun;
    const nrOfTrainingRuns = jsonObject.nrOfTrainingRuns;
    const currentModel = jsonObject.currentModel;

    let teacherModels: BaseModelConfig[] = [];
    if (jsonObject.teacherModels && jsonObject.teacherModels.length > 0) {
      teacherModels = jsonObject.teacherModels.map((model: any) => ModelConfigFactory.createConfig(model, DISTILLED_MODEL) as BaseModelConfig);
    }

    return {
      distilledModel,
      currentModelStats,
      lastTrainingRun,
      currentTrainingRun,
      teacherModels,
      nrOfTrainingRuns,
      currentModel
    };
  }
  public static createConfig(inputConfig: string | ModelConfigInput |BaseModelConfig, type: string): BaseModelConfig {
    if (inputConfig instanceof BaseModelConfig) {
      return inputConfig;
    }

    if (typeof inputConfig === 'string') {
      // Backwards compatibility
      if (type === DISTILLED_MODEL) {
        const config = DEFAULT_STUDENT_MODELS[DEFAULT_DISTILLED_MODEL_NAME]; // Update as needed
        config.modelName = inputConfig;
        return config;
      } else if (type === TEACHER_MODEL) {
        // @ts-ignore
        if (!DEFAULT_TEACHER_MODELS[inputConfig]) {
          throw new Error("Error loading the teacher model, saved config model was saved a string but is not a default model");
        }
        // @ts-ignore
        return DEFAULT_TEACHER_MODELS[inputConfig];
      }
    } else {
      switch (inputConfig.provider) {
        case OPENAI_PROVIDER:
          return new OpenAIConfig(inputConfig);
        case LLAMA_BEDROCK_PROVIDER:
          return new LlamaBedrockConfig(inputConfig);
        case TITAN_BEDROCK_PROVIDER:
          return new TitanBedrockConfig(inputConfig);
        default:
          try {
            return new BaseModelConfig(inputConfig); // Assuming BaseModelConfig can be constructed this way
          } catch (error) {
            throw new Error("Error loading the model config, saved config model was saved as a dict but is not a valid model config");
          }
      }
    }
    throw new Error("Invalid inputConfig type");
  }
}