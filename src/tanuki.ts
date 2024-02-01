import * as ts from 'typescript';
import * as path from 'path';
//import PatchFunctionCompiler from './patchFunctionCompiler';
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
import { DEFAULT_EMBEDDING_MODEL_NAME, DEFAULT_TEACHER_MODEL_NAMES } from "./constants";
dotenv.config();

type ExpectFunctionType = (actual: any) => {
  toMatchObject: (expected: any) => Promise<void>;
  toEqual: (expected: any) => Promise<void>;
  toBe: (expected: any) => Promise<void>;
  toBeNull: () => Promise<void>;
  not: {
    toMatchObject: (expected: any) => Promise<void>;
    toEqual: (expected: any) => Promise<void>;
    toBe: (expected: any) => Promise<void>;
    toBeNull: () => Promise<void>;
  };
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
    /*const configPath = ts.findConfigFile(
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

     */
  }

  static isWithinAlign() {
    return this.isAlignActive;
  }

  static align(testSuite: (it: ItFunctionType) => void) {
    //console.log(`Executing test suite: ${description}`);
    Tanuki.isAlignActive = true;

    const testPromises: Promise<any>[] = [];
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
      const expect: ExpectFunctionType = (actual) => {
        const baseExpectation = async (expected: any, equal: boolean) => {
          if (actual.functionDescription.type !== FunctionType.SYMBOLIC && actual.functionDescription !== expected.functionDescription) {
            throw new Error(
              'Expected function descriptions to match, but they did not. Embeddable functions can only be aligned with invocations of the same function.'
            );
          }

          handleAlignStatement({
            actual: await actual,
            expected: expected,
            equal: equal,
          });
        };

        const baseObj = {
          toMatchObject: (expected: any) => baseExpectation(expected, true),
          toEqual: (expected: any) => baseExpectation(expected, true),
          toBe: (expected: any) => baseExpectation(expected, true),
          toBeNull: () => baseExpectation(null, true),
        };

        return {
          ...baseObj,
          not: {
            toMatchObject: (expected: any) => baseExpectation(expected, false),
            toEqual: (expected: any) => baseExpectation(expected, false),
            toBe: (expected: any) => baseExpectation(expected, false),
            toBeNull: () => baseExpectation(null, false),
          },
        };
      };

      const testResult = new Promise((resolve, reject) => {
        Promise.resolve(testFn(expect))
          .then(resolve)
          .catch(reject);
      });
      if (testResult && typeof testResult.then === 'function') {
        testPromises.push(testResult);
      }
    };
    // Execute the test suite
    testSuite(it);
    // Wait for all test promises to complete
    return Promise.allSettled(testPromises).then(results => {
      Tanuki.isAlignActive = false;
      // Check if any of the promises were rejected and throw an error if so
      const rejectedResult = results.find(result => result.status === 'rejected');
      if (rejectedResult) {
        throw "reason" in rejectedResult ? rejectedResult.reason : rejectedResult
      }
    });
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
    return async function(this: any, input: InputType): Promise<OutputType> {
      const parentClass = this;
      const functionDescription = Register.getNamedFunctions(parentClass, docstring);
      //const functionName: string = getCallerInfo(namedFunctions);
      //const functionName: string = foundFunction.name
      //const functionDescription: FunctionDescription = Register.loadFunctionDescription(functionName, docstring);
      let embeddingCase = false;
      if (config) {
        FunctionModeler.setConfig(functionDescription, config);
        functionModeler.loadSymbolicAlignStatements(functionDescription.hash());
      }

      if (
        functionDescription.outputTypeDefinition == 'Embedding' ||
        functionDescription.type === FunctionType.EMBEDDABLE ||
        /^Embedding<.*>$/.test(<string>functionDescription.outputTypeDefinition)
      ) {
        embeddingCase = true;
      }

      if (!config?.teacherModels) {
        config = {
          ...config,
          teacherModels: embeddingCase ? [DEFAULT_EMBEDDING_MODEL_NAME] : DEFAULT_TEACHER_MODEL_NAMES
        };
      }
      if (config && config.teacherModels && config?.teacherModels?.length > 0) {
        FunctionModeler.configureTeacherModels(config.teacherModels, functionDescription.hash(), functionDescription.type);
      }

      // Flag that we are within a tanuki.align block
      if (Tanuki.isWithinAlign()) {
        // This is a total hack. We need to figure out a better way to do this rather than abusing the type system.
        return {
          functionDescription,
          input,
        } as unknown as OutputType;
      }

      if (embeddingCase) {
        return (await embeddingModeler.call(
          input,
          functionDescription,
          validator,
        )) as unknown as OutputType;
      } else {
        return (await languageModeler.call(
          input,
          functionDescription,
          validator,
          config.generationParams
        )) as unknown as OutputType;
      }
    };
  };
}

export function getCallerInfo(availableFunctionPaths: string[]): string {
  // availableFunctionPaths is an array of function names with their parent objects prepended.
  // We need to just get the function name, so we split on the '.' and take the last element.
  const availableFunctionNames = availableFunctionPaths.map((path) => path.split('.').pop() as string);
  try {
    // Throw an error and catch it to access the stack trace
    throw new Error();
  } catch (error) {
    if (error instanceof Error && error.stack) {
      const stackLines = error.stack.split('\n');
      let functionName: string = '';
      let path = '';
      // Iterate through stack lines and match with available function names
      for (const line of stackLines) {
        // Use a regular expression to extract a potential function name
        const match = /at\s+([^\s]+)\s+/.exec(line);
        if (match && match[1]) {

          // Check if extracted name is in the list of available function names
          path = match.input?.split('(')[1].split(')')[0];
          const functionName_ = match[1].split('.').pop(); // Extracting function name
          if (functionName_ && availableFunctionNames.includes(functionName_)) {
            functionName = functionName_; // Returns the matched function name
          }
        }
      }
      if (functionName !== '') {
        for (const line of stackLines) {
          // Use a regular expression to extract a potential function name
          const matchForParentObject = /\s+at\s(\w+)\.apply\s\[as\s+/.exec(line);
          if (matchForParentObject && matchForParentObject[1]) {
            // Check to see if functionName is in matchForParentObject[1]
            if (matchForParentObject.input.includes(functionName)) {
              const parentObject = matchForParentObject[1].split('.').pop(); // Extracting function name

              if (parentObject && parentObject !== 'Function') {
                functionName = parentObject + '.' + functionName;
              }
            }
          }
        }
        return functionName;
      }
    }
  }
  return '';
}

