import { OPENAI_PROVIDER } from '../../constants';
import { BaseModelConfig } from './baseModelConfig';

export class OpenAIConfig extends BaseModelConfig {
  modelName: string;
  provider: string = OPENAI_PROVIDER;
  contextLength: number;
  constructor(config: {
    modelName: string;
    contextLength: number;
    instructions?: string;
    parsingHelperTokens?: { startToken: string; endToken: string };
  }) {
    super({
      modelName: config.modelName,
      instructions: config.instructions,
      parsingHelperTokens: config.parsingHelperTokens,
      provider: OPENAI_PROVIDER,
      contextLength: config.contextLength,
      chatTemplate: OpenAIConfig.prototype.chatTemplate,
    });
    this.modelName = config.modelName;
    this.contextLength = config.contextLength;
  }
}
