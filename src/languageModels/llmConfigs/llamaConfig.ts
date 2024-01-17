import { LLAMA_BEDROCK_PROVIDER, OPENAI_PROVIDER } from "../../constants";
import { BaseModelConfig } from "./baseModelConfig";

export class LlamaBedrockConfig extends BaseModelConfig {
  chatTemplate: string = "[INST]{system_message}[/INST]\n{user_prompt}";
  instructions: string = "You are given below a function description and input data. The function description of what the function must carry out can be found in the Function section, with input and output type hints. The input data can be found in Input section. Using the function description, apply the function to the Input and return a valid output type, that is acceptable by the output_class_definition and output_class_hint.\\nINCREDIBLY IMPORTANT: Only output a JSON-compatible string in the correct response format. Use the [END] tokens to specify when the output ends.";
  parsingHelperTokens: { startToken: string; endToken: string; } = { startToken: "[START]\n", endToken: "\n[END]" };

  constructor(config: {modelName: string, contextLength: number}) {
    super({
      modelName: config.modelName,
      provider: LLAMA_BEDROCK_PROVIDER,
      contextLength: config.contextLength,
      chatTemplate: LlamaBedrockConfig.prototype.chatTemplate}
    )
    this.modelName = config.modelName;
    this.contextLength = config.contextLength;
  }
}