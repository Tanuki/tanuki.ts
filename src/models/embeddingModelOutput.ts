import { Embedding } from './embedding';
class EmbeddingModelOutput<EmbeddingDataType> {
  generatedResponse: Embedding<EmbeddingDataType>;
  distilledModel: boolean;

  constructor(
    generatedResponse: Embedding<EmbeddingDataType>,
    distilledModel: boolean
  ) {
    this.generatedResponse = generatedResponse;
    this.distilledModel = distilledModel;
  }
}

export default EmbeddingModelOutput;
