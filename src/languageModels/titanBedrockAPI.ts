import { BedrockAPI } from "./bedrockAPI";
import { BaseModelConfig } from "./llmConfigs/baseModelConfig";
import { TitanBedrockConfig } from "./llmConfigs/titanConfig";
import { Embedding } from "../models/embedding";
import { FinetuneJob } from "../models/finetuneJob";

export class TitanBedrockAPI extends BedrockAPI {
  constructor() {
    super(); // Initialize the base class
  }

  generate(model: BaseModelConfig, systemMessage: string, prompt: string, ...kwargs: any[]): string {
    // Method implementation
    throw new Error("Response generations for Titan Bedrock API have not yet been implemented");
  }

  async embed(texts: string[], model: TitanBedrockConfig, ...kwargs: any[]): Promise<Embedding<any>[]> {
    let embeddings: Embedding<any>[] = [];
    for (const text of texts) {
      const body = JSON.stringify({ inputText: text });
      try {
        const responseBody = await this.sendApiRequest(model, body);
        const embeddingData = responseBody["embedding"]; // Assuming the response structure
        const embedding = new Embedding(embeddingData);
        embeddings.push(embedding);
      } catch (error) {
        console.error(`An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return []; // or handle the error differently
      }
    }
    return embeddings;
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
