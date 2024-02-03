import { FinetuneJob } from '../models/finetuneJob';

abstract class LLMFinetuneAPI {
  abstract listFinetuned(limit: number, ...args: any[]): Promise<FinetuneJob[]>;

  abstract getFinetuned(jobId: string, ...args: any[]): Promise<FinetuneJob>;

  abstract finetune(...args: any[]): Promise<FinetuneJob>;
}

export default LLMFinetuneAPI;
