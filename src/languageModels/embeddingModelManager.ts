import EmbeddingAPI from './embeddingAPI';
import { FunctionDescription } from '../models/functionDescription';
import { Embedding } from '../models/embedding';
import FunctionModeler from '../functionModeler';
import { Validator } from "../validator";
import { APIManager } from "../APIManager";
import { DEFAULT_EMBEDDING_MODEL_NAME, DEFAULT_EMBEDDING_MODELS } from "../constants";

class EmbeddingModelManager<T> {
  private functionModeler: FunctionModeler; // Replace 'any' with the actual type of your FunctionModeler
  private apiManager: APIManager
  private currentGenerators: Record<string, string>;

  constructor(functionModeler: any, apiManager: APIManager) {
    this.functionModeler = functionModeler;
    this.apiManager = apiManager;
    this.currentGenerators = {};
  }

  private getEmbeddingCase(input: any, functionDescription: FunctionDescription, examples?: any): (string | any)[] {
    const content = `Name: ${functionDescription.name}\nArgs: ${JSON.stringify(input)}`;
    const functionHash = functionDescription.hash();
    let model = null;
    if (functionHash in FunctionModeler.teacherModelsOverride) {
      model = FunctionModeler.teacherModelsOverride[functionHash][0];
    } else {
      model = DEFAULT_EMBEDDING_MODELS[DEFAULT_EMBEDDING_MODEL_NAME]
    }

    if (!(functionHash in this.currentGenerators)) {
      console.info(`Generating function embeddings with ${functionHash}`);
      this.currentGenerators[functionHash] = model.modelName;
    } else if (this.currentGenerators[functionHash] !== model.modelName) {
      console.info(`Switching function embeddings from ${this.currentGenerators[functionHash]} to ${model.modelName}`);
      this.currentGenerators[functionHash] = model.modelName;
    }
    return [content, model];
  }

  async call(
    input: any,
    functionDescription: FunctionDescription,
    validator: Validator
  ): Promise<Embedding<T>> {
    const [prompt, model] = this.getEmbeddingCase(input, functionDescription);
    // @ts-ignore
    const embeddingResponses: Embedding<T>[] = await this.apiManager[model.provider].embed([prompt]);

    // Assuming the first response is the desired embedding
    const embeddingResponse = embeddingResponses[0];

    // TODO do some type validation here.
    return embeddingResponse //validator.instantiate(functionDescription.outputTypeDefinition, embeddingResponse);
  }
}

export default EmbeddingModelManager;