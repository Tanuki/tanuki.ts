import {FunctionExample} from "../../src/models/functionExample";
import {APIManager} from "../../src/APIManager";
import FunctionModeler from "../../src/functionModeler";
import {IDatasetWorker} from "../../src/trackers/IDatasetWorker";
import {FunctionType} from "../../src/models/functionType";
import {BaseModelConfig} from "../../src/languageModels/llmConfigs/baseModelConfig";
import {PatchConfig} from "../../src/models/patchConfig";
import {FunctionDescription} from "../../src/models/functionDescription";
import {DEFAULT_DISTILLED_MODEL_NAME, DEFAULT_STUDENT_MODELS, DEFAULT_TEACHER_MODELS} from "../../src/constants";
import {OpenAIAPI} from "../../src/languageModels/openAIAPI";
import {FunctionConfig} from "../../src/models/functionConfig";

describe('getExamplesFromAlignmentBuffer', () => {
    let dataWorkerMock: jest.Mocked<IDatasetWorker>;
    let apiManagerMock: jest.Mocked<APIManager>;
    let llmMock: jest.Mocked<OpenAIAPI>;
    let functionModeler: FunctionModeler;


    beforeEach(() => {
        dataWorkerMock = {
            loadDataset: jest.fn(),
            loadExistingDatasets: jest.fn().mockReturnValue({}),
            logEmbeddableAlign: jest.fn(),
            logSymbolicAlign: jest.fn(),
            logSymbolicPatch: jest.fn(),
            loadFunctionConfig: jest.fn(),
            updateFunctionConfig: jest.fn(),
        };
        llmMock = new OpenAIAPI() as jest.Mocked<OpenAIAPI>;
        apiManagerMock = new APIManager() as jest.Mocked<APIManager>;
        functionModeler = new FunctionModeler(dataWorkerMock, apiManagerMock);
        // @ts-ignore (public)
        functionModeler.functionConfigs = {
            "testFuncHash": {
                distilledModel: DEFAULT_STUDENT_MODELS[DEFAULT_DISTILLED_MODEL_NAME],
                currentModelStats: {
                    runningFaults: [],
                    trainedOnDatapoints: 100 // Assuming an initial value
                },
                teacherModels: [DEFAULT_TEACHER_MODELS.llama_13b_chat_aws],
                nrOfTrainingRuns: 1,
                lastTrainingRun: {
                    trainedOnDatapoints: 100
                },
                currentTrainingRun: {}
            }
        };
        // @ts-ignore (public)
        functionModeler.updateConfigFile = jest.fn(); // Mock to avoid file system operations
        jest.spyOn(dataWorkerMock, 'logEmbeddableAlign').mockReturnValue([true, false]);
    });

    it('correctly decodes and parses FunctionExample objects from buffer', () => {
        // Prepare a buffer with valid JSON strings of FunctionExampleData
        const examplesData = [
            { args: [1, 2], output: 3 },
            { args: [4, 5], output: 9 }
        ];
        const buffer = new TextEncoder().encode(examplesData.map(e => JSON.stringify(e)).join('\n'));

        // Assuming we have a way to create a FunctionExample instance from FunctionExampleData
        // @ts-ignore (public)
        const results = functionModeler.getExamplesFromAlignmentBuffer(buffer);

        expect(results.length).toBe(2);
        expect(results[0].output).toBe(3);
        expect(results[1].args).toEqual([4, 5]);
    });

    it('filters out duplicate examples based on unique identifiers', () => {
        const duplicateExampleData = { args: [1, 2], output: 3 };
        const buffer = new TextEncoder().encode(
            JSON.stringify(duplicateExampleData) + '\n' +
            JSON.stringify(duplicateExampleData) // Duplicate entry
        );
        // @ts-ignore (public)
        const results = functionModeler.getExamplesFromAlignmentBuffer(buffer);

        expect(results.length).toBe(1); // Expect only one instance despite duplicates
    });

    it('does not return more examples than the specified max limit', () => {
        // Prepare a buffer with 25 valid unique examples
        let exampleData = []
        for (let i = 0; i < 25; i++) {
            exampleData.push({ args: [i], output: i + 1 });
        }

        const buffer = new TextEncoder().encode(exampleData.map(e => JSON.stringify(e)).join('\n'));
        const max = 20;

        // @ts-ignore (public)
        const results = functionModeler.getExamplesFromAlignmentBuffer(buffer, max);

        expect(results.length).toBe(max);
        expect(results[0].args).toEqual([0]);
        expect(results[results.length - 1].args).toEqual([max - 1]);
    });

    it('skips malformed JSON strings', () => {
        const malformedExample = "{ this is: 'not a valid json' }";
        const validExample = { args: [1, 2], output: 3 };
        const buffer = new TextEncoder().encode(
            malformedExample + '\n' +
            JSON.stringify(validExample)
        );
        // @ts-ignore (public)
        const results = functionModeler.getExamplesFromAlignmentBuffer(buffer);

        expect(results.length).toBe(1); // Only the valid example should be parsed
    });
})