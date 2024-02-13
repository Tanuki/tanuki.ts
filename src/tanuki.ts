import { IDatasetWorker } from './trackers/IDatasetWorker';
import FilesystemBufferedLogger from './trackers/filesystemBufferedLogger';
import { Register } from './register';
import { LanguageModelManager } from './languageModels/languageModelManager';
import EmbeddingModelManager from './languageModels/embeddingModelManager';
import { Validator } from './validator';
import { PatchConfig } from './models/patchConfig';
import { FunctionDescription } from './models/functionDescription';
import FunctionModeler from './functionModeler';
import * as dotenv from 'dotenv';
import { FunctionType } from './models/functionType';
import { APIManager } from './APIManager';
import {
  DEFAULT_DISTILLED_MODEL_NAME,
  DEFAULT_TEACHER_MODEL_NAMES,
} from './constants';
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

const apiManager = new APIManager();
// currently only use buffered logger as default
const functionModeler = new FunctionModeler(logger, apiManager);
Register.loadFunctions();

const languageModeler = new LanguageModelManager(
  functionModeler,
  512,
  apiManager
);
const embeddingModeler = new EmbeddingModelManager(functionModeler, apiManager);
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
  constructor() {}

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
        actual: {
          functionDescription: FunctionDescription;
          input: any[];
        } | null;
        expected: { functionDescription: FunctionDescription; input: any[] };
        equal: boolean;
      }) {
        const functionDescription =
          expected.functionDescription as unknown as FunctionDescription;
        const input = expected.input;
        if (functionDescription.type === FunctionType.SYMBOLIC) {
          const funcHash = functionDescription.hash();
          functionModeler.saveSymbolicAlignStatements(funcHash, input, actual);
        } else {
          if (isMockResponseType(actual)) {
            //expected
            if (equal) {
              functionModeler.saveEmbeddableAlignStatements(
                functionDescription.hash(),
                input,
                [actual.input],
                []
              );
            } else {
              functionModeler.saveEmbeddableAlignStatements(
                functionDescription.hash(),
                input,
                [],
                [actual.input]
              );
            }
          }
        }
      }
      const expect: ExpectFunctionType = (expected: {
        functionDescription: FunctionDescription;
        input: any[];
      }) => {
        const baseExpectation = async (
          actual:
            | Promise<{
                functionDescription: FunctionDescription;
                input: any[];
              }>
            | { functionDescription: FunctionDescription; input: any[] }
            | null,
          equal: boolean
        ) => {
          /*const awaitedExpected: {
            functionDescription: FunctionDescription;
            input: any[];
          } = await actual;*/
          const awaitedActual = await actual;

          if (expected instanceof Promise) {
            expected = await expected;
          }

          if (
            expected?.functionDescription.type !== FunctionType.SYMBOLIC &&
            expected?.functionDescription.type !== FunctionType.EMBEDDABLE
          ) {
            throw new Error(
              'Expected function type to be either symbolic or embeddable'
            );
          }

          const expectedFunctionName = expected?.functionDescription.name;
          const expectedFunctionDocstring =
            expected?.functionDescription.docstring;

          if (
            expected?.functionDescription.type !== FunctionType.SYMBOLIC &&
            (expected?.functionDescription.name !== expectedFunctionName ||
              expected?.functionDescription.docstring !==
                expectedFunctionDocstring)
          ) {
            throw new Error(
              'Expected embedding function descriptions to match, but they did not. Embeddable functions must be aligned with invocations of the same function in order to train the embedding space.'
            );
          }

          handleAlignStatement({
            actual: awaitedActual,
            expected: expected,
            equal: equal,
          });
        };

        const baseObj = {
          toMatchObject: (
            expected: Promise<{
              functionDescription: FunctionDescription;
              input: any[];
            }>
          ) => baseExpectation(expected, true),
          toEqual: (
            expected: Promise<{
              functionDescription: FunctionDescription;
              input: any[];
            }>
          ) => baseExpectation(expected, true),
          toBe: (
            expected: Promise<{
              functionDescription: FunctionDescription;
              input: any[];
            }>
          ) => baseExpectation(expected, true),
          toBeNull: () => baseExpectation(null, true),
        };

        return {
          ...baseObj,
          not: {
            toMatchObject: (
              expected: Promise<{
                functionDescription: FunctionDescription;
                input: any[];
              }>
            ) => baseExpectation(expected, false),
            toEqual: (
              expected: Promise<{
                functionDescription: FunctionDescription;
                input: any[];
              }>
            ) => baseExpectation(expected, false),
            toBe: (
              expected: Promise<{
                functionDescription: FunctionDescription;
                input: any[];
              }>
            ) => baseExpectation(expected, false),
            toBeNull: () => baseExpectation(null, false),
          },
        };
      };

      const testResult = new Promise((resolve, reject) => {
        Promise.resolve(testFn(expect)).then(resolve).catch(reject);
      });
      if (typeof testResult.then === 'function') {
        testPromises.push(testResult);
      }
    };
    // Execute the test suite
    testSuite(it);
    // Wait for all test promises to complete
    return Promise.allSettled(testPromises).then(results => {
      Tanuki.isAlignActive = false;
      // Check if any of the promises were rejected and throw an error if so
      const rejectedResult = results.find(
        result => result.status === 'rejected'
      );
      if (rejectedResult) {
        throw 'reason' in rejectedResult
          ? rejectedResult.reason
          : rejectedResult;
      }
    });
  }
}

export function patch<OutputType, InputType>(config?: PatchConfig) {
  return (strings: TemplateStringsArray) => {
    //...expressions: any[] -> Expressions make our functions less idempotent

    // Extract the prompt (instruction) from the template literal
    const docstring = strings.join('');

    if (config?.environmentId) {
      FunctionModeler.environmentId = config?.environmentId;
    }

    // Return a function that takes an input of type InputType and returns a value of type OutputType
    return async function (this: any, input: InputType): Promise<OutputType> {
      const parentClass = this as unknown as {
        name: string;
        sourceFile: string;
      }; // Doing this for readability
      const functionDescription = Register.getNamedFunctions(
        parentClass,
        docstring
      );

      let embeddingCase = false;
      if (config) {
        FunctionModeler.setConfig(functionDescription, config);
      }

      if (
        functionDescription.outputTypeDefinition == 'Embedding' ||
        functionDescription.type === FunctionType.EMBEDDABLE ||
        /^Embedding<.*>$/.test(<string>functionDescription.outputTypeDefinition)
      ) {
        embeddingCase = true;
      }

      if (!embeddingCase) {
        functionModeler.loadSymbolicAlignStatements(functionDescription.hash());
      }

      FunctionModeler.configureFunctionModels(
        functionDescription.hash(),
        functionDescription.type,
        config?.teacherModels || DEFAULT_TEACHER_MODEL_NAMES,
        config?.studentModel || DEFAULT_DISTILLED_MODEL_NAME
      );

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
          functionDescription
          //validator,
        )) as unknown as OutputType;
      } else {
        const response = (await languageModeler.call(
          input as any[],
          functionDescription,
          validator,
          config?.generationParams ?? {}
        )) as unknown as OutputType;

        return response as unknown as OutputType;
      }
    };
  };
}

/*
export function getCallerInfo(availableFunctionPaths: string[]): string {
  // availableFunctionPaths is an array of function names with their parent objects prepended.
  // We need to just get the function name, so we split on the '.' and take the last element.
  const availableFunctionNames = availableFunctionPaths.map(
    path => path.split('.').pop() as string
  );
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
          const matchForParentObject = /\s+at\s(\w+)\.apply\s\[as\s+/.exec(
            line
          );
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
*/
