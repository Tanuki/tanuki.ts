import { LLAMA_BEDROCK_PROVIDER, OPENAI_PROVIDER, TITAN_BEDROCK_PROVIDER } from "../../constants";
import { BaseModelConfig } from "./baseModelConfig";

/*
  Config for AWS Titan Bedrock models.
  The custom prompting parameters have been left empty
  as LLM generation has not been implemented yet, only embedding
 */
export class TitanBedrockConfig extends BaseModelConfig {

  modelName: string
  provider: string = TITAN_BEDROCK_PROVIDER
  contextLength: number = -1

  constructor(config: {modelName: string, contextLength: number}) {
    super({
      modelName: config.modelName,
      provider: TITAN_BEDROCK_PROVIDER,
      contextLength: config.contextLength, }
    )
    this.modelName = config.modelName;
    this.contextLength = config.contextLength;
  }
}