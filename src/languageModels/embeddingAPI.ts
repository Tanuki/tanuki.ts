import { Embedding } from "../models/embedding";

abstract class EmbeddingAPI<T> {
  // Abstract method without default parameter values
  abstract embed(texts: string[], model?: string, ...args: any[]): Promise<Embedding<T>[]>;
}

export default EmbeddingAPI;