export class LanguageModelOutput {
  generatedResponse: string;
  suitableForFinetuning: boolean;
  distilledModel: boolean;

  constructor(
    generatedResponse: string,
    suitableForFinetuning: boolean,
    distilledModel: boolean
  ) {
    this.generatedResponse = generatedResponse;
    this.suitableForFinetuning = suitableForFinetuning;
    this.distilledModel = distilledModel;
  }
}
