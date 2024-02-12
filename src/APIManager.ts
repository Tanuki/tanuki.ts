import {
  OPENAI_PROVIDER,
  LLAMA_BEDROCK_PROVIDER,
  TITAN_BEDROCK_PROVIDER,
  TOGETHER_AI_PROVIDER,
  ANYSCALE_PROVIDER
} from './constants';
import { FinetuneJob } from './models/finetuneJob';
import { Embedding } from './models/embedding';
import { BaseModelConfig } from './languageModels/llmConfigs/baseModelConfig';
import {OpenAIConfig} from "./languageModels/llmConfigs/openAIConfig";
import Buffer from "buffer";

export interface Finetunable {
  listFinetuned: (modelConfig: OpenAIConfig, limit: number, ...args: any[]) => Promise<FinetuneJob[]>;
  getFinetuned: (jobId: string, modelConfig: OpenAIConfig) => Promise<FinetuneJob>;
  finetune: (fileBuffer: Buffer,  suffix: string, modelConfig: OpenAIConfig,) => Promise<FinetuneJob>;
}

export interface Inferable {
  generate: (
    model: BaseModelConfig,
    systemMessage: string,
    prompt: any,
    kwargs: any
  ) => Promise<string>;
}
export interface Embeddable {
  embed: (
    texts: string[],
    model: BaseModelConfig,
    kwargs: any
  ) => Promise<Embedding<any>[]>;
}
class APIManager {
  private apiProviders: { [key: string]: Finetunable | Inferable | Embeddable };

  constructor() {
    this.apiProviders = {};
  }

  async getProvider(
    provider: string
  ): Promise<Finetunable | Inferable | Embeddable> {
    if (!(provider in this.apiProviders)) {
      await this.addApiProvider(provider);
    }

    return this.apiProviders[provider];
  }

  keys(): string[] {
    return Object.keys(this.apiProviders);
  }

  private async addApiProvider(provider: string): Promise<void> {
    if (provider === ANYSCALE_PROVIDER) {
      const { AnyscaleAPI } = await import('./languageModels/anyscaleAPI');
      try {
        this.apiProviders[provider] = new AnyscaleAPI();
      } catch (e) {
        throw new Error(
            `You need to install the openai package to use the Anyscale api provider. 
                      Please install it with \`pip install openai\``
        )
      }
    } else if (provider === OPENAI_PROVIDER) {
      const { OpenAIAPI } = await import('./languageModels/openAIAPI');
      try {
        this.apiProviders[provider] = new OpenAIAPI();
      } catch (e) {
        throw new Error(
            `You need to install the openai package to use the OpenAI api provider. 
                        Please install it with \`pip install openai\``
        )
      }
    } else if (provider === LLAMA_BEDROCK_PROVIDER) {
      const { LLamaBedrockAPI } = await import(
        './languageModels/llamaBedrockAPI'
      );
      this.apiProviders[provider] = new LLamaBedrockAPI();
    } else if (provider === TITAN_BEDROCK_PROVIDER) {
      const { TitanBedrockAPI } = await import(
        './languageModels/titanBedrockAPI'
      );
      this.apiProviders[provider] = new TitanBedrockAPI();
    } else if (provider === TOGETHER_AI_PROVIDER) {
      const { TogetherAIAPI } = await import('./languageModels/togetherAIAPI');
      this.apiProviders[provider] = new TogetherAIAPI();
    } else {
      throw new Error(`Model provider ${provider} is currently not supported.`);
    }
  }
}

export { APIManager };
