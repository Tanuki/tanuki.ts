import { BedrockAPI } from './bedrockAPI';
import { BaseModelConfig } from './llmConfigs/baseModelConfig';
import { FinetuneJob } from '../models/finetuneJob';

const LLM_GENERATION_PARAMETERS = ['temperature', 'top_p', 'max_new_tokens'];

export class LLamaBedrockAPI extends BedrockAPI {
  constructor() {
    super();
  }

  async generate(
    model: BaseModelConfig,
    systemMessage: string,
    prompt: string,
    kwargs: Record<string, any>
  ): Promise<string> {
    const temperature = kwargs.temperature ?? 0.1;
    const topP = kwargs.top_p ?? 1;
    const maxNewTokens = kwargs.max_new_tokens;
    const unsupportedParams = Object.keys(kwargs).filter(
      param => !LLM_GENERATION_PARAMETERS.includes(param)
    );

    if (unsupportedParams.length > 0) {
      console.warn(
        `Unused generation parameters sent as input: (${unsupportedParams.join(
          ', '
        )}). For Llama Bedrock, only the following parameters are supported: [${LLM_GENERATION_PARAMETERS.join(
          ','
        )}]`
      );
    }

    const chatPrompt = model.chatTemplate;
    if (!chatPrompt) {
      throw new Error(
        'Chat prompt is not defined for this model. Please define it in the model config'
      );
    }

    let finalPrompt = chatPrompt
      .replace('{system_message}', systemMessage)
      .replace('{user_prompt}', prompt);
    if (model.parsingHelperTokens?.startToken) {
      finalPrompt = finalPrompt + model.parsingHelperTokens.startToken;
    }
    const body = JSON.stringify({
      prompt: finalPrompt,
      max_gen_len: maxNewTokens,
      temperature: temperature,
      top_p: topP,
    });

    const responseBody = (await this.sendApiRequest(model, body)) as {
      generation: string;
    };
    let choice: string = responseBody['generation'];

    if (model.parsingHelperTokens?.endToken) {
      choice = choice.split(model.parsingHelperTokens.endToken)[0];
    }

    return choice.trim();
  }

  // eslint-disable-next-line require-await, @typescript-eslint/require-await
  public async getFinetuned(jobId: string): Promise<FinetuneJob> {
    console.debug(
      'Getting finetuned model for Llama Bedrock API with the following jobId: ',
      jobId
    );
    throw new Error('`getFinetuned` not implemented yet.');
  }

  // eslint-disable-next-line require-await, @typescript-eslint/require-await
  public async finetune(
    fileBuffer: Buffer,
    suffix: string
  ): Promise<FinetuneJob> {
    console.debug(
      'Finetuning model for Llama Bedrock API with the following suffix: ',
      suffix
    );
    throw new Error('finetune not implemented yet.');
  }

  // eslint-disable-next-line require-await, @typescript-eslint/require-await
  public async listFinetuned(limit = 100): Promise<FinetuneJob[]> {
    console.debug(
      'Listing finetuned models for Llama Bedrock API with the following limit: ',
      limit
    );
    throw new Error('listFinetuned not implemented yet.');
  }
}
