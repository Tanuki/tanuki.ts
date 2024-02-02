import { FunctionDescription } from '../models/functionDescription';
import { Embedding } from '../models/embedding';
import FunctionModeler from '../functionModeler';
import { APIManager, Embeddable } from '../APIManager';
import {
  DEFAULT_EMBEDDING_MODEL_NAME,
  DEFAULT_EMBEDDING_MODELS,
} from '../constants';
import { BaseModelConfig } from './llmConfigs/baseModelConfig';

export class EmbeddingModelManager<T> {
  private functionModeler: FunctionModeler; // Replace 'any' with the actual type of your FunctionModeler
  private apiManager: APIManager;
  private initializedFunctions: Map<string, any>;

  constructor(functionModeler: any, apiManager: APIManager) {
    this.functionModeler = functionModeler;
    this.apiManager = apiManager;
    this.initializedFunctions = new Map<string, any>();
  }

  private getEmbeddingCase(
    input: any,
    functionDescription: FunctionDescription
    //examples?: any // Add this parameter if we want to support promptable embedding functions
  ): (string | BaseModelConfig)[] {
    const content = `Name: ${functionDescription.name}\nArgs: ${JSON.stringify(
      input
    )}`;
    const funcHash = functionDescription.hash();
    let model = null;
    if (funcHash in FunctionModeler.teacherModelsOverride) {
      model = FunctionModeler.teacherModelsOverride[funcHash][0];
    } else {
      model = DEFAULT_EMBEDDING_MODELS[DEFAULT_EMBEDDING_MODEL_NAME];
    }

    const currentGenerator = this.initializedFunctions.get(funcHash) as {
      model: string;
      examples: any[];
    };
    if (currentGenerator) {
      const generatorModel = currentGenerator.model;
      if (generatorModel === '') {
        console.info(
          `Found ${currentGenerator.examples.length} align statements for ${functionDescription.name}. Generating function outputs with ${model.modelName}.`
        );
        this.initializedFunctions.set(funcHash, {
          ...currentGenerator,
          model: model.modelName,
        });
      } else if (generatorModel !== model.modelName) {
        console.info(
          `Switching output generation from ${generatorModel} to ${model.modelName} for function ${functionDescription.name}.`
        );
        this.initializedFunctions.set(funcHash, {
          ...currentGenerator,
          model: model.modelName,
        });
      }
    }
    return [content, model];
  }

  async call(
    input: any,
    functionDescription: FunctionDescription
  ): Promise<Embedding<T>> {
    const [prompt, config] = this.getEmbeddingCase(
      input,
      functionDescription
    ) as [string, BaseModelConfig];

    console.log(`Calling ${functionDescription.name} with ${prompt}`);
    try {
      const provider = (await this.apiManager.getProvider(
        config.provider
      )) as Embeddable;
      const embeddingResponses: Embedding<T>[] = await provider.embed(
        [prompt],
        config,
        {}
      );

      // Assuming the first response is the desired embedding
      const embeddingResponse = embeddingResponses[0];

      // TODO do some type validation here.
      return embeddingResponse; //validator.instantiate(functionDescription.outputTypeDefinition, embeddingResponse);
    } catch (e) {
      throw new Error(
        `Embedding provider ${config.provider} is not supported.`
      );
    }
  }
}

export default EmbeddingModelManager;
