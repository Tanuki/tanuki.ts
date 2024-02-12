import { FinetuneJob } from '../models/finetuneJob';
import {OpenAIConfig} from "./llmConfigs/openAIConfig";
import Buffer from "buffer";

abstract class LLMFinetuneAPI {
  abstract listFinetuned(modelConfig: OpenAIConfig, limit: number, ...args: any[]): Promise<FinetuneJob[]>;
  abstract getFinetuned(jobId: string, modelConfig: OpenAIConfig): Promise<FinetuneJob>;
  abstract finetune(fileBuffer: Buffer,  suffix: string, modelConfig: OpenAIConfig,): Promise<FinetuneJob>;
}

export default LLMFinetuneAPI;
