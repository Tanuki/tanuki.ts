import EmbeddingAPI from './embeddingAPI';
import { FunctionDescription } from '../models/functionDescription';
import { Embedding } from '../models/embedding';
import FunctionModeler from '../functionModeler';
import { Validator } from "../validator";

class EmbeddingModelManager<T> {
  private functionModeler: FunctionModeler; // Replace 'any' with the actual type of your FunctionModeler
  private apiProviders: Record<string, EmbeddingAPI<T>>;

  constructor(functionModeler: any, apiProviders: Record<string, EmbeddingAPI<T>>) {
    this.functionModeler = functionModeler;
    this.apiProviders = apiProviders;
  }

  private getEmbeddingCase(input: any, functionDescription: FunctionDescription, examples?: any): string {
    const content = `Name: ${functionDescription.name}\nArgs: ${JSON.stringify(input)}`;
    return content;
  }

  async call(
    input: any,
    functionDescription: FunctionDescription,
    validator: Validator
  ): Promise<Embedding<T>> {
    const prompt = this.getEmbeddingCase(input, functionDescription);
    const embeddingResponses: Embedding<T>[] = await this.apiProviders["openai"].embed([prompt]);

    // Assuming the first response is the desired embedding
    const embeddingResponse = embeddingResponses[0];

    // TODO do some type validation here.
    return embeddingResponse //validator.instantiate(functionDescription.outputTypeDefinition, embeddingResponse);
  }
}

export default EmbeddingModelManager;