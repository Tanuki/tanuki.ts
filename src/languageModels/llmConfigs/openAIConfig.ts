import { OPENAI_PROVIDER } from "../../constants";
import { BaseModelConfig } from "./baseModelConfig";

export class OpenAIConfig extends BaseModelConfig {
  modelName: string;
  provider: string = OPENAI_PROVIDER;
  contextLength: number;
  constructor(config: {modelName: string, contextLength: number}) {
    super({
      modelName: config.modelName,
      provider: OPENAI_PROVIDER,
      contextLength: config.contextLength,
      chatTemplate: OpenAIConfig.prototype.chatTemplate}
    )
    this.modelName = config.modelName;
    this.contextLength = config.contextLength;
  }
}