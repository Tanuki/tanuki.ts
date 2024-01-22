import 'openai/shims/node';
import { OpenAI, toFile } from 'openai';
import { Embedding } from '../models/embedding';
import { FinetuneJob } from '../models/finetuneJob';

import axios from 'redaxios';
//import { CreateEmbeddingResponse, FineTuning } from "openai/resources";
import { Readable } from 'stream';
import { OpenAIConfig } from "./llmConfigs/openAIConfig";
import { DEFAULT_DISTILLED_MODEL_NAME, DEFAULT_GENERATIVE_MODELS } from "../constants";
import { BaseModelConfig } from "./llmConfigs/baseModelConfig";
import CreateEmbeddingResponse = OpenAI.CreateEmbeddingResponse;
import FineTuning = OpenAI.FineTuning;
import { FineTuningJob } from "openai/resources/fine-tuning";

const LLM_GENERATION_PARAMETERS: string[] = ["temperature", "top_p", "max_new_tokens", "frequency_penalty", "presence_penalty"]

interface FineTuningJobResponse {
  id: string;
  status: string;
  fineTunedModel?: BaseModelConfig | string |null;
}

export class OpenAIAPI {
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

  public async embed(texts: string[], model: OpenAIConfig, kwargs: any = {}): Promise<Embedding<number>[]> {
    try {
      const response: CreateEmbeddingResponse = await this.client.embeddings.create({
          input: texts,
          model: model.modelName,
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

  /**
   * The main generation function, given the args, kwargs, functionModeler, function description and model type, generate a response and check if the datapoint can be saved to the finetune dataset
   * The main generation function, given the args, kwargs, functionModeler, function description and model type, generate a response
   * @param model (OpenAIConfig): The model to use for generation.
   * @param systemMessage (str): The system message to use for generation.
   * @param prompt (str): The prompt to use for generation.
   * @param kwargs (dict): Additional generation parameters.
   * @param maxRetries
   */
  public async generate(
    model: OpenAIConfig,
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
      temperature = 0.1,
      topP = 1,
      frequencyPenalty = 0,
      presencePenalty = 0
    } = kwargs;

    const params: OpenAI.Chat.ChatCompletionCreateParams = {
      model: model.modelName,
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
        return this.createFinetuneJob(job);
      });
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to list fine-tuned jobs: ${errorMessage}`);
    }
  }

  public async getFinetuned(jobId: string): Promise<FinetuneJob> {
    this.checkApiKey();
    const response = await this.client.fineTuning.jobs.retrieve(jobId);
      /*const response = await axios.get(`${this.openaiUrl}/fine-tuning/jobs/${jobId}`, {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );*/
    const job = this.createFinetuneJob(response);
    return job;
  }
  private createFinetuneJob(response: FineTuningJobResponse): FinetuneJob {
    const modelConfig = JSON.parse(JSON.stringify(DEFAULT_GENERATIVE_MODELS[DEFAULT_DISTILLED_MODEL_NAME]));
    modelConfig.model_name = response.fineTunedModel ?? 'Not Available'; // Handle null case

    return new FinetuneJob(response.id, response.status, modelConfig);
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
      const finetuningResponse: FineTuningJob = await this.client.fineTuning.jobs.create({
        training_file: fileUploadResponse.id,
        model: 'gpt-3.5-turbo',
        suffix: suffix
      });

      const finetunedModelConfig = JSON.parse(JSON.stringify(DEFAULT_GENERATIVE_MODELS[DEFAULT_DISTILLED_MODEL_NAME]));
      finetunedModelConfig.model_name = finetuningResponse.fine_tuned_model ?? 'Not Available'; // Handle null case

      return new FinetuneJob(finetuningResponse.id, finetuningResponse.status, finetunedModelConfig);
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
