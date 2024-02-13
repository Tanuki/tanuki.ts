import {FunctionDescription} from "../../src/models/functionDescription";

// Extend the jest module to include typings for our mocks - a bit of a hack.
// @ts-ignore
declare module 'jest' {
  interface Jest {
    // Extend the function prototype to include the custom static method
    configureTeacherModels: jest.Mock;
  }
}

// Extend the module where FunctionModeler is defined
declare module '../../src/functionModeler' {
  // Extend the default export to include the static method
  export default interface FunctionModeler {
    // Note: This assumes FunctionModeler is a class, adjust as necessary
    new (logger: any, apiManager: any): {
      // Instance methods and properties here
    };
    configureTeacherModels: jest.Mock; // Add the static method
  }
}

jest.mock('../../src/functionModeler', () => {
  // Mock the constructor and instance methods
  const mockSaveSymbolicAlignStatements = jest.fn();
  const mockSaveEmbeddableAlignStatements = jest.fn();
  const mockInstance = {
    saveSymbolicAlignStatements: mockSaveSymbolicAlignStatements,
    saveEmbeddableAlignStatements: mockSaveEmbeddableAlignStatements,
    loadSymbolicAlignStatements: jest.fn(),
    // other instance methods
  };

  // Mock static methods
  const mockConfigureTeacherModels = jest.fn();

  // Combine instance and static mocks
  const MockedFunctionModeler = jest.fn(() => mockInstance);
  // @ts-ignore
  MockedFunctionModeler.configureTeacherModels = mockConfigureTeacherModels;

  return { default: MockedFunctionModeler };
});

// Mock patch function to simulate a symbolic function
// eslint-disable-next-line @typescript-eslint/no-unsafe-return
jest.mock('../../src/tanuki', () => ({
  ...jest.requireActual('../../src/tanuki'), // Import and spread the actual exports
  patch: jest.fn().mockImplementation(() => {
    return (strings: TemplateStringsArray) => {
      return async (input: any[]): Promise<{
        functionDescription: FunctionDescription;
        input: any[];
      }> => {
        let funcType = FunctionType.SYMBOLIC;
        if (strings[0] == "This embeds an instruction") {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          funcType = FunctionType.EMBEDDABLE;
        }
        const functionDescription = {
          hash: () => 'mockHash',
          type: funcType,
          name: 'mock',
          docstring: strings.join(''),
        };
        // Simplify the logic to return 'Good', 'Bad', or null based on input
        return Promise.resolve({ functionDescription, input });
      };
    };
  }),
}));

jest.mock('../../src/functionModeler', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const mockInstanceMethods = {
    saveSymbolicAlignStatements: jest.fn(),
    saveEmbeddableAlignStatements: jest.fn(),
    // Additional methods...
  };
// Function constructor mock
  const MockedFunctionModeler = jest.fn(() => mockInstanceMethods);

  // Static method mock
  // @ts-ignore
  MockedFunctionModeler.configureTeacherModels = jest.fn();

  // Correctly return the mock as a default export
  return MockedFunctionModeler;
});

import { IDatasetWorker } from '../../src/trackers/IDatasetWorker';
import { APIManager } from '../../src/APIManager';
import FunctionModeler from '../../src/functionModeler';
import { FunctionType } from '../../src/models/functionType';
import { Tanuki, patch } from '../../src/tanuki';
import { Embedding } from "../../src/models/embedding";
describe('handleAlignStatement', () => {

  let apiManagerMock: jest.Mocked<APIManager>

  const dataWorkerMock: jest.Mocked<IDatasetWorker> = {
    loadDataset: jest.fn(),
    loadExistingDatasets: jest.fn().mockReturnValue({}),
    logEmbeddableAlign: jest.fn(),
    logSymbolicAlign: jest.fn(),
    logSymbolicPatch: jest.fn(),
    loadFunctionConfig: jest.fn(),
    updateFunctionConfig: jest.fn(),
  };

  let functionModeler: FunctionModeler;

  beforeEach(() => {
    jest.clearAllMocks();
    // @ts-ignore
    apiManagerMock = new APIManager() as jest.Mocked<APIManager>;
    functionModeler = new FunctionModeler(dataWorkerMock, apiManagerMock);
    jest.spyOn(functionModeler, 'saveSymbolicAlignStatements').mockImplementation(() => {

    });
  })

  class Functions {
    static func = patch<string, string>()`This is a mock function`;
  }

  it('executes test suite and calls saveSymbolicAlignStatements for symbolic functions', async () => {

      // Test Tanuki.align with a mocked test suite
      await Tanuki.align(it => {
        it('mock test', async expect => {
          await expect(Functions.func("love")).toEqual("Good");
        });
      });

      // Assert that saveSymbolicAlignStatements was called with expected arguments
      expect(
          // eslint-disable-next-line @typescript-eslint/unbound-method
          functionModeler.saveSymbolicAlignStatements
      ).toHaveBeenCalledWith('mockHash', 'love', 'Good');
    });

  it('executes test suite and calls saveEmbeddableAlignStatements for embeddable functions', async () => {
    // Setup the conditions necessary for `saveEmbeddableAlignStatements` to be called
    await Tanuki.align(async it => {
      it('embeddable function test', async expect => {
        const embeddableFunc = patch<Embedding<number>, string>()`This embeds an instruction`;
        const embedResult1 = await embeddableFunc("Where can I buy cupcakes");
        const embedResult2 = await embeddableFunc("What is the capital of France");

        await expect(embedResult1).not.toEqual(embedResult2)
      });
    });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(functionModeler.saveEmbeddableAlignStatements).toHaveBeenCalledWith(
        'mockHash',
        "Where can I buy cupcakes", // The input that triggers embeddable align statement
        expect.anything(),
        ["What is the capital of France"], // Another input that triggers embeddable align statement
    );
  });

});