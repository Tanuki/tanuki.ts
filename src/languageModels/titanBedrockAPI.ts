import { BedrockAPI } from './bedrockAPI';
import { BaseModelConfig } from './llmConfigs/baseModelConfig';
import { TitanBedrockConfig } from './llmConfigs/titanConfig';
import { Embedding } from '../models/embedding';
import { FinetuneJob } from '../models/finetuneJob';

export class TitanBedrockAPI extends BedrockAPI {
  constructor() {
    super(); // Initialize the base class
  }

  generate(
    model: BaseModelConfig,
    systemMessage: string,
    prompt: string,
    kwargs: {
      temperature?: number;
      topP?: number;
      frequencyPenalty?: number;
      presencePenalty?: number;
      maxNewTokens?: number;
      stop?: string;
    } = {}
  ): string {
    console.debug(
      'Generating response for Titan Bedrock API with the following parameters: ',
      kwargs
    );
    // Method implementation
    throw new Error(
      'Response generations for Titan Bedrock API have not yet been implemented'
    );
  }

  async embed(
    texts: string[],
    model: TitanBedrockConfig,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    kwargs: any
  ): Promise<Embedding<any>[]> {
    const embeddings: Embedding<any>[] = [];
    for (const text of texts) {
      const body = JSON.stringify({ inputText: text });
      try {
        const responseBody = (await this.sendApiRequest(model, body)) as {
          embedding: number[];
        };
        const embeddingData = responseBody['embedding'];
        const embedding = new Embedding(embeddingData);
        embeddings.push(embedding);
      } catch (error) {
        console.error(
          `An error occurred: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
        return []; // or handle the error differently
      }
    }
    return embeddings;
  }

  // eslint-disable-next-line require-await, @typescript-eslint/require-await
  public async getFinetuned(jobId: string): Promise<FinetuneJob> {
    console.debug(
      'Getting finetuned model for Titan Bedrock API with the following jobId: ',
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
      'Finetuning model for Titan Bedrock API with the following suffix: ',
      suffix
    );
    throw new Error('`finetune` not implemented yet.');
  }

  // eslint-disable-next-line require-await, @typescript-eslint/require-await
  public async listFinetuned(limit = 100): Promise<FinetuneJob[]> {
    console.debug(
      'Listing finetuned models for Titan Bedrock API with the following limit: ',
      limit
    );
    throw new Error('`listFinetuned` not implemented yet.');
  }
}
