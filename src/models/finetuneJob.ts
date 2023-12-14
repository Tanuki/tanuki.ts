export class FinetuneJob {
  id: string;
  status: string;
  fineTunedModel: string | undefined;

  constructor(id: string, status: string, fineTunedModel: string | undefined) {
    this.id = id;
    this.status = status;
    this.fineTunedModel = fineTunedModel;
  }
}