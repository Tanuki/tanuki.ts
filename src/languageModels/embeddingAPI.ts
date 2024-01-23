import { Embedding } from "../models/embedding";
import { BaseModelConfig } from "./llmConfigs/baseModelConfig";

abstract class EmbeddingAPI<T> {
  // Abstract method without default parameter values
  abstract embed(texts: string[], model?: BaseModelConfig, kwargs?: any): Promise<Embedding<T>[]>;
}

export default EmbeddingAPI;