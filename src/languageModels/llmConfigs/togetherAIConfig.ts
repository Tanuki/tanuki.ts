import { TOGETHER_AI_PROVIDER } from "../../constants";
import { BaseModelConfig } from "./baseModelConfig";

/*
  Config for Together AI models.
 */
export class TogetherAIConfig extends BaseModelConfig {

    provider: string = TOGETHER_AI_PROVIDER
    instructions: string = "You are given below a function description and input data. The function description of what the function must carry out can be found in the Function section, with input and output type hints. The input data can be found in Input section. Using the function description, apply the function to the Input and return a valid output type, that is acceptable by the output_class_definition and output_class_hint.\nINCREDIBLY IMPORTANT: Only output a JSON-compatible string in the correct response format. The outputs will be between |START| and |END| tokens, the |START| token will be given in the prompt, use the |END| token to specify when the output ends. Only return the output to this input."

    constructor(config: {
        modelName: string,
        contextLength: number,
        instructions?: string,
        parsingHelperTokens?: {startToken: string, endToken: string},
        chatTemplate?: string,
    }) {
        super({
            modelName: config.modelName,
            instructions: config.instructions || TogetherAIConfig.prototype.instructions,
            parsingHelperTokens: config.parsingHelperTokens,
            provider: TOGETHER_AI_PROVIDER,
            contextLength: config.contextLength,
            chatTemplate: config.chatTemplate || TogetherAIConfig.prototype.chatTemplate},
        )
    }
}