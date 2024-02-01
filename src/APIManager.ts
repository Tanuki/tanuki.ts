import { OPENAI_PROVIDER, LLAMA_BEDROCK_PROVIDER, TITAN_BEDROCK_PROVIDER, TOGETHER_AI_PROVIDER } from './constants';
import { FinetuneJob } from './models/finetuneJob';

interface Finetunable {
  listFinetuned: (limit: number) => Promise<FinetuneJob[]>;
  getFinetuned: (jobId: string) => Promise<FinetuneJob>;
  finetune: (fileBuffer: Buffer, suffix: string) => Promise<FinetuneJob>;
}
class APIManager {
  private apiProviders: { [key: string]: Finetunable };

  constructor() {
    this.apiProviders = {};
  }

  async getProvider(provider: string): Promise<Finetunable> {
    if (!(provider in this.apiProviders)) {
      await this.addApiProvider(provider);
    }

    return this.apiProviders[provider];
  }

  keys(): string[] {
    return Object.keys(this.apiProviders);
  }

  private async addApiProvider(provider: string): Promise<void> {
    if (provider === OPENAI_PROVIDER) {
      const { OpenAIAPI } = await import('./languageModels/openAIAPI');
      this.apiProviders[provider] = new OpenAIAPI();
    } else if (provider === LLAMA_BEDROCK_PROVIDER) {
      const { LLamaBedrockAPI } = await import('./languageModels/llamaBedrockAPI');
      this.apiProviders[provider] = new LLamaBedrockAPI();
    } else if (provider === TITAN_BEDROCK_PROVIDER) {
      const {TitanBedrockAPI} = await import('./languageModels/titanBedrockAPI');
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