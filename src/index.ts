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


const ALIGN_LEVEL_NUM = 15
const PATCH_LEVEL_NUM = 14
const ALIGN_FILE_NAME = '.align';

const alignable_functions = {}

// Set up basic configuration
const logger: IDatasetWorker = new FilesystemBufferedLogger()

const APIProviders = { openai: new OpenAIApi() };
// currently only use buffered logger as default
const functionModeler = new FunctionModeler(logger, APIProviders);
Register.loadFunctions();

const languageModeler = new LanguageModelManager(functionModeler,  512, APIProviders, );
const embeddingModeler = new EmbeddingModelManager(functionModeler, APIProviders)
//const telemetryEnabled: boolean = true
const validator = new Validator()


export function patch<OutputType, InputType>(config?: PatchConfig) {

  return (strings: TemplateStringsArray, ...expressions: any[]) => {

    // Extract the prompt (instruction) from the template literal
    const docstring = strings.join("");

    // Return a function that takes an input of type InputType and returns a value of type OutputType
    return (input: InputType): OutputType => {

      const functionName: string = getCallerInfo();
      const functionDescription: FunctionDescription = Register.loadFunctionDescription(functionName, docstring)

      if (functionDescription.outputTypeDefinition == "Embedding" || /^Embedding<.*>$/.test(functionDescription.outputTypeDefinition)) {
        return embeddingModeler.call(input, functionDescription, validator) as unknown as OutputType
      } else {
        return languageModeler.call(input, functionDescription, validator) as unknown as OutputType
      }
    };
  }
}


export function getCallerInfo(): string {
  try {
    // Throw an error and catch it to access the stack trace
    throw new Error();
  } catch (error) {
    if (error instanceof Error && error.stack) {
      const stackLines = error.stack.split("\n");
      // Depending on the environment, you might need to adjust the line number
      const callerLine: string = stackLines[2] || stackLines[1];

      // Use a regular expression to extract the function name
      const match = /at Function\.(\w+)/.exec(callerLine);
      if (match && match[1]) {
        return match[1]; // Returns the function name
      }
    }
  }
  return '';
}
export function align(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const assertionCompiler = new AssertionCompiler(
    '/Users/jackhopkins/WebstormProjects/tanuki.ts/test'
  );
  const mocks = assertionCompiler.mocks()
  console.log(mocks)
}



