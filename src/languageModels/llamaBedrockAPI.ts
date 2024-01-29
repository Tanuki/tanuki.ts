import { BedrockAPI } from "./bedrockAPI";
import { BaseModelConfig } from "./llmConfigs/baseModelConfig";
import { FinetuneJob } from "../models/finetuneJob";

const LLM_GENERATION_PARAMETERS = ["temperature", "top_p", "max_new_tokens"];

export class LLamaBedrockAPI extends BedrockAPI {
  constructor() {
    super();
  }

  async generate(model: BaseModelConfig, systemMessage: string, prompt: string, kwargs: Record<string, any>): Promise<string> {
    const temperature = kwargs.temperature ?? 0.1;
    const topP = kwargs.top_p ?? 1;
    const maxNewTokens = kwargs.max_new_tokens;
    const unsupportedParams = Object.keys(kwargs).filter(param => !LLM_GENERATION_PARAMETERS.includes(param));

    if (unsupportedParams.length > 0) {
      console.warn(`Unused generation parameters sent as input: ${unsupportedParams}. For Llama Bedrock, only the following parameters are supported: ${LLM_GENERATION_PARAMETERS}`);
    }

    const chatPrompt = model.chatTemplate;
    if (!chatPrompt) {
      throw new Error("Chat prompt is not defined for this model. Please define it in the model config");
    }

    const finalPrompt = chatPrompt.replace("{system_message}", systemMessage).replace("{user_prompt}", prompt);
    const body = JSON.stringify({
      prompt: finalPrompt,
      max_gen_len: maxNewTokens,
      temperature: temperature,
      top_p: topP,
    });

    const responseBody = await this.sendApiRequest(model, body);
    let choice: string = responseBody["generation"];

    if (model.parsingHelperTokens?.endToken) {
      choice = choice.split(model.parsingHelperTokens.endToken)[0];
    }

    return choice.trim();
  }

  public async getFinetuned(jobId: string): Promise<FinetuneJob> {
    throw new Error("`getFinetuned` not implemented yet.");
  }

  public async finetune(fileBuffer: Buffer, suffix: string): Promise<FinetuneJob> {
    throw new Error("`finetune` not implemented yet.");
  }

  public async listFinetuned(limit = 100): Promise<FinetuneJob[]> {
    throw new Error("`listFinetuned` not implemented yet.");
  }

}