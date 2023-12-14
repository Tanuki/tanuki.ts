import { OpenAI, toFile } from "openai"; // Assuming 'openai' is a TypeScript package
import { Embedding } from '../models/embedding';
import { FinetuneJob } from '../models/finetuneJob';

import axios from 'axios';
import { CreateEmbeddingResponse } from 'openai/resources';
import { Readable } from 'stream';

interface FineTuningJobResponse {
  id: string;
  status: string;
  fine_tuned_model?: string | null;
}

export class OpenAIApi {
  private apiKey: string;
  private client: OpenAI;
  private readonly openaiUrl: string =
    'https://api.openai.com/v1/chat/completions';

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || "";
    if (!this.apiKey) {
      throw new Error('OpenAI API key is not set');
    }
    this.client = new OpenAI({ apiKey: this.apiKey });
  }

  public async embed(texts: string[], model = 'text-similarity-babbage-001', kwargs: any = {}): Promise<Embedding<number>[]> {
    try {
      const response: CreateEmbeddingResponse = await this.client.embeddings.create({
          input: texts,
          model: model,
          ...kwargs,
        });

      if (response.object !== 'list' || response.data.length !== texts.length) {
        throw new Error('Invalid response format from OpenAI');
      }

      return response.data.map(embeddingResponse => {
        if (embeddingResponse.object !== 'embedding') {
          throw new Error('Invalid embedding object in response');
        }
        return new Embedding(embeddingResponse.embedding); // Assuming Embedding is a class or a function that processes the embedding data
      });
    } catch (error) {
      console.error('An error occurred', error);
      throw error; // Rethrowing the error is more idiomatic in TypeScript, instead of returning null
    }
  }

  public async generate(
    model: string,
    systemMessage: string,
    prompt: string,
    kwargs: {
      temperature?: number;
      topP?: number;
      frequencyPenalty?: number;
      presencePenalty?: number;
    } = {},
    maxRetries = 5 // Define the maximum number of retries
  ): Promise<string> {
    const {
      temperature = 0,
      topP = 1,
      frequencyPenalty = 0,
      presencePenalty = 0
    } = kwargs;

    const params: OpenAI.Chat.ChatCompletionCreateParams = {
      model: model,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: prompt }
      ],
      temperature: temperature,
      max_tokens: 512,
      top_p: topP,
      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty
    };

    let retryCount = 0;
    while (retryCount <= maxRetries) {
      try {
        const completion = await this.client.chat.completions.create(params);
        return completion.choices[0]?.message?.content?.trim() || '';
      } catch (error: any) {
        if (retryCount === maxRetries) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          throw new Error(
            `Error generating response after ${maxRetries} retries: ${errorMessage}`
          );
        }
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000)); // Exponential backoff
      }
    }

    throw new Error(
      'OpenAI API failed to generate a response after maximum retries'
    );
  }

  public async listFinetuned(limit = 100): Promise<FinetuneJob[]> {
    this.checkApiKey();
    try {
      const response = await this.client.fineTuning.jobs.list({ limit });
      return response.data.map((job: FineTuningJobResponse) => {
        const fineTunedModel = job.fine_tuned_model ?? 'Not Available'; // Handle null case
        return new FinetuneJob(job.id, job.status, fineTunedModel);
      });
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to list fine-tuned jobs: ${errorMessage}`);
    }
  }

  public async getFinetuned(jobId: string): Promise<FinetuneJob> {
    this.checkApiKey();
    try {
      const response = await axios.get(`${this.openaiUrl}/fine-tuning/jobs/${jobId}`, {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );

      const data: FineTuningJobResponse = response.data;

      return new FinetuneJob(data.id, data.status, data.fine_tuned_model ?? '')
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to retrieve fine-tuned job: ${errorMessage}`);
    }
  }

  public async finetune(
    fileBuffer: Buffer,
    suffix: string
  ): Promise<FinetuneJob> {
    this.checkApiKey();
    try {
      // Convert Buffer to ReadStream
      // eslint-disable-next-line node/no-unsupported-features/node-builtins
      const fileStream = Readable.from(fileBuffer);
      // Upload the file
      const fileUploadResponse = await this.client.files.create({
        file: await toFile(fileStream),
        purpose: 'fine-tune'
      });

      // Start fine-tuning
      const finetuningResponse = await this.client.fineTuning.jobs.create({
        training_file: fileUploadResponse.id,
        model: 'gpt-3.5-turbo',
        suffix: suffix
      });

      return new FinetuneJob(
        finetuningResponse.id,
        finetuningResponse.status,
        finetuningResponse.fine_tuned_model || ''
      );
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create fine-tuning job: ${errorMessage}`);
    }
  }

  private checkApiKey() {
    if (!this.apiKey) {
      this.apiKey = process.env.OPENAI_API_KEY || '';
      if (this.apiKey === '') {
        throw new Error('OpenAI API key is not set');
      }
    }
  }
}
