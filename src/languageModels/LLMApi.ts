abstract class LLMApi {

  abstract generate(
    model: string,
    systemMessage: string,
    prompt: string,
    ...kwargs: any[]
  ): Promise<string>;
}

export default LLMApi;