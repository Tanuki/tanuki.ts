import * as ts from 'typescript';
import * as path from 'path';
import PatchFunctionCompiler from './patchFunctionCompiler';
import { IDatasetWorker } from './trackers/IDatasetWorker';
import FilesystemBufferedLogger from './trackers/filesystemBufferedLogger';
import { OpenAIAPI } from './languageModels/openAIAPI';
import { Register } from './register';
import { LanguageModelManager } from './languageModels/languageModelManager';
import EmbeddingModelManager from './languageModels/embeddingModelManager';
import { Validator } from './validator';
import { PatchConfig } from './models/patchConfig';
import { FunctionDescription } from './models/functionDescription';
import FunctionModeler from './functionModeler';
import * as dotenv from 'dotenv';
import { FunctionType } from './models/functionType';
import fs from 'fs';
import { APIManager } from "./APIManager";
dotenv.config();

type ExpectFunctionType = (actual: any) => {
  toMatchObject: (expected: any) => void;
  toEqual: (expected: any) => void;
  toBe: (expected: any) => void;
  notEqual: (expected: any) => void;
  // Add other methods as necessary
};
// Type for the 'it' function
type ItFunctionType = (
  description: string,
  testFn: (expect: ExpectFunctionType) => void
) => void;

// Set up basic configuration
const logger: IDatasetWorker = new FilesystemBufferedLogger();

const apiManager= new APIManager();
// currently only use buffered logger as default
const functionModeler = new FunctionModeler(logger, apiManager);
Register.loadFunctions();

const languageModeler = new LanguageModelManager(
  functionModeler,
  512,
  apiManager
);
const embeddingModeler = new EmbeddingModelManager(
  functionModeler,
  apiManager
);
//const telemetryEnabled: boolean = true
const validator = new Validator();

type MockResponseType = {
  functionDescription: FunctionDescription;
  input: any;
};

function isMockResponseType(obj: any): obj is MockResponseType {
  // Check for existence and type of each property
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return (
    obj &&
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    typeof obj.functionDescription !== 'undefined' && // Add more specific checks if needed
    'input' in obj
  ); // Checks for the existence of the 'input' property
}

export class Tanuki {
  private static isAlignActive = false;
  constructor() {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const configPath = ts.findConfigFile(
      './',
      // eslint-disable-next-line @typescript-eslint/unbound-method
      fs.existsSync,
      //ts.sys.fileExists,
      'tsconfig.json'
    );
    if (!configPath) {
      throw new Error("Could not find a valid 'tsconfig.json'.");
    }
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsedConfig = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      path.dirname(configPath)
    );
    // Create a TypeScript program with the parsed configuration
    const program = ts.createProgram(
      parsedConfig.fileNames,
      parsedConfig.options
    );
    const patchFunctionCompiler = new PatchFunctionCompiler(program);
    patchFunctionCompiler.compile();
  }

  static isWithinAlign() {
    return this.isAlignActive;
  }

  static align(testSuite: (it: ItFunctionType) => void) {
    //console.log(`Executing test suite: ${description}`);
    Tanuki.isAlignActive = true;

    const it: ItFunctionType = (desc, testFn) => {
      if (!Tanuki.isAlignActive) {
        throw new Error('it() can only be called within an align block.');
      }
      function handleAlignStatement({
        actual,
        expected,
        equal,
      }: {
        actual: { functionDescription: FunctionDescription; input: any };
        expected: any;
        equal: boolean;
      }) {
        const functionDescription =
          actual.functionDescription as unknown as FunctionDescription;
        const input = actual.input;
        if (functionDescription.type === FunctionType.SYMBOLIC) {
          functionModeler.saveSymbolicAlignStatements(
            functionDescription.hash(),
            input,
            expected
          );
        } else {
          if (isMockResponseType(expected)) {
            //expected
            if (equal) {
              functionModeler.saveEmbeddableAlignStatements(
                functionDescription.hash(),
                input,
                [expected.input],
                []
              );
            } else {
              functionModeler.saveEmbeddableAlignStatements(
                functionDescription.hash(),
                input,
                [],
                [expected.input]
              );
            }
          }
        }
      }
      const expect: ExpectFunctionType = actual => ({
        toMatchObject: async expected => {
          handleAlignStatement({
            actual: await actual,
            expected: expected,
            equal: true,
          });
        },
        toEqual: async expected => {
          handleAlignStatement({
            actual: await actual,
            expected: expected,
            equal: true,
          });
        },
        toBe: async expected => {
          handleAlignStatement({
            actual: await actual,
            expected: expected,
            equal: true,
          });
        },
        notEqual: async expected => {
          handleAlignStatement({
            actual: await actual,
            expected: expected,
            equal: false,
          });
        },
      });

      testFn(expect);
    };
    //global.it = it;
    testSuite(it);
    Tanuki.isAlignActive = false;
  }
}

export function patch<OutputType, InputType>(config?: PatchConfig) {
  return (strings: TemplateStringsArray, ...expressions: any[]) => {
    // Extract the prompt (instruction) from the template literal
    const docstring = strings.join('');

    if (config?.environmentId) {
      FunctionModeler.environmentId = config?.environmentId;
    }

    // Return a function that takes an input of type InputType and returns a value of type OutputType
    return async (input: InputType): Promise<OutputType> => {
      const functionName: string = getCallerInfo(Register.getNamedFunctions());
      const functionDescription: FunctionDescription = Register.loadFunctionDescription(functionName, docstring);

      if (config) {
        FunctionModeler.setConfig(functionDescription.hash(), config);
      }

      if (config && config.teacherModels && config?.teacherModels?.length > 0) {
        FunctionModeler.configureTeacherModels(config.teacherModels, functionDescription.hash(), functionDescription.type);
      }

      // Alter behavior if within tanuki.align
      if (Tanuki.isWithinAlign()) {
        // This is a total hack. We need to figure out a better way to do this rather than abusing the type system.
        return {
          functionDescription,
          input,
        } as unknown as OutputType;
      }

      if (
        functionDescription.outputTypeDefinition == 'Embedding' ||
        /^Embedding<.*>$/.test(<string>functionDescription.outputTypeDefinition)
      ) {
        return (await embeddingModeler.call(
          input,
          functionDescription,
          validator
        )) as unknown as OutputType;
      } else {
        return (await languageModeler.call(
          input,
          functionDescription,
          validator
        )) as unknown as OutputType;
      }
    };
  };
}

/*
export function getCallerInfo(availableFunctionNames: string[]): string {
  try {
    // Throw an error and catch it to access the stack trace
    throw new Error();
  } catch (error) {
    if (error instanceof Error && error.stack) {
      const stackLines = error.stack.split('\n');
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
}*/
export function getCallerInfo(availableFunctionNames: string[]): string {
  try {
    // Throw an error and catch it to access the stack trace
    throw new Error();
  } catch (error) {
    if (error instanceof Error && error.stack) {
      const stackLines = error.stack.split('\n');

      // Iterate through stack lines and match with available function names
      for (const line of stackLines) {
        // Use a regular expression to extract a potential function name
        const match = /at\s+([^\s]+)\s+/.exec(line);
        if (match && match[1]) {
          // Check if extracted name is in the list of available function names
          const functionName = match[1].split('.').pop(); // Extracting function name
          if (functionName && availableFunctionNames.includes(functionName)) {
            return functionName; // Returns the matched function name
          }
        }
      }
    }
  }
  return '';
}

