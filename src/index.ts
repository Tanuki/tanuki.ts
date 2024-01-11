import AssertionCompiler from "./assertionCompiler";
import { FunctionDescription } from "./models/functionDescription";
import { Register } from "./register";
import { FunctionModeler } from './functionModeler';
import { PatchConfig } from "./models/patchConfig";
import FilesystemBufferedLogger from "./trackers/filesystemBufferedLogger";
import { LanguageModelManager } from "./languageModels/languageModelManager";
import { OpenAIApi } from "./languageModels/openAIApi";
import { IDatasetWorker } from "./trackers/IDatasetWorker";
import EmbeddingModelManager from "./languageModels/embeddingModelManager";
import { v4 as uuidv4 } from 'uuid';
// Define the configuration options interface
import * as dotenv from "dotenv";
import { Validator } from "./validator";
dotenv.config();


export function align(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const assertionCompiler = new AssertionCompiler(
    '/Users/jackhopkins/WebstormProjects/tanuki.ts/test'
  );
  const mocks = assertionCompiler.mocks()
  console.log(mocks)
}



