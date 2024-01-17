import { BaseModelConfig } from "./llmConfigs/baseModelConfig";

abstract class LLMApi {

  abstract generate(
    model: BaseModelConfig,
    systemMessage: string,
    prompt: string,
    ...kwargs: any[]
  ): Promise<string>;
}

export default LLMApi;