import { BEDROCK_PROVIDER, LLAMA_BEDROCK_PROVIDER } from "../../constants";
import { BaseModelConfig } from "./baseModelConfig";

/**
 Config for Anthropic's Claude model.
 The custom chat template has been added to the config.
 */
export class ClaudeConfig extends BaseModelConfig {
  modelName: string = "anthropic.claude-v2:1";
  chatTemplate: string = "\n\nHuman: {system_prompt}\n\n {user_prompt}\n\nAssistant:\n";
  provider: string = "bedrock";
  contextLength: number = 2000;

  constructor(config: {modelName: string, contextLength: number}) {
    super({
      modelName: config.modelName,
      provider: BEDROCK_PROVIDER,
      contextLength: config.contextLength,
      chatTemplate: ClaudeConfig.prototype.chatTemplate}
    )
    this.modelName = config.modelName;
    this.contextLength = config.contextLength;
  }
}