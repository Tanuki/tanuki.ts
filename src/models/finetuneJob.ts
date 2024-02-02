import { BaseModelConfig } from '../languageModels/llmConfigs/baseModelConfig';

export class FinetuneJob {
  id: string;
  status: string;
  fineTunedModel: BaseModelConfig;

  constructor(id: string, status: string, fineTunedModel: BaseModelConfig) {
    this.id = id;
    this.status = status;
    this.fineTunedModel = fineTunedModel;
  }
}
