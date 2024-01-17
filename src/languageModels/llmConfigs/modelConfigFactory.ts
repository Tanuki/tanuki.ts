import {
  DEFAULT_DISTILLED_MODEL_NAME,
  DEFAULT_GENERATIVE_MODELS, DISTILLED_MODEL,
  LLAMA_BEDROCK_PROVIDER,
  OPENAI_PROVIDER, TEACHER_MODEL,
  TITAN_BEDROCK_PROVIDER
} from "../../constants";
import { LlamaBedrockConfig } from "./llamaConfig";
import { OpenAIConfig } from "./openAIConfig";
import { TitanBedrockConfig } from "./titanConfig";
import { BaseModelConfig } from "./baseModelConfig";

interface ModelConfigInput {
  modelName: string;
  provider: string;
  contextLength: number;
  // Include other required fields here
  [key: string]: any; // This allows for additional dynamic properties
}

class ModelConfigFactory {
  static createConfig(inputConfig: string | ModelConfigInput |BaseModelConfig, type: string): BaseModelConfig {
    if (inputConfig instanceof BaseModelConfig) {
      return inputConfig;
    }

    if (typeof inputConfig === 'string') {
      // Backwards compatibility
      if (type === DISTILLED_MODEL) {
        const config = DEFAULT_GENERATIVE_MODELS[DEFAULT_DISTILLED_MODEL_NAME]; // Update as needed
        config.modelName = inputConfig;
        return config;
      } else if (type === TEACHER_MODEL) {
        // @ts-ignore
        if (!DEFAULT_GENERATIVE_MODELS[inputConfig]) {
          throw new Error("Error loading the teacher model, saved config model was saved a string but is not a default model");
        }
        // @ts-ignore
        return DEFAULT_GENERATIVE_MODELS[inputConfig];
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