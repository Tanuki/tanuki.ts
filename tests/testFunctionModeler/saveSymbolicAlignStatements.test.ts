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

describe('saveSymbolicAlignStatements', () => {
    let dataWorkerMock: jest.Mocked<IDatasetWorker>;
    let apiManagerMock: jest.Mocked<APIManager>;
    let llmMock: jest.Mocked<OpenAIAPI>;
    let functionModeler: FunctionModeler;


    beforeEach(() => {
        dataWorkerMock = {
            loadDataset: jest.fn(),
            loadExistingDatasets: jest.fn().mockReturnValue({}),
            logEmbeddableAlign: jest.fn(),
            logSymbolicAlign: jest.fn().mockReturnValue([true, true]),
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
        FunctionModeler.storeDataBlacklist = new Set();
        // @ts-ignore (public)
        functionModeler.updateConfigFile = jest.fn(); // Mock to avoid file system operations
        jest.spyOn(dataWorkerMock, 'logEmbeddableAlign').mockReturnValue([true, false]);
    });

    it('updates dataset sizes and buffer on successful save', () => {
        const functionHash = 'funcHash';
        const args = [1, 2, 3];
        const output = 'result';

        functionModeler.saveSymbolicAlignStatements(functionHash, args, output);
        // @ts-ignore (public)
        const dataWorker = functionModeler.dataWorker;
        expect(dataWorker.logSymbolicAlign).toHaveBeenCalled();
        // @ts-ignore (public)
        expect(functionModeler.datasetSizes.SYMBOLIC_ALIGNMENTS[functionHash]).toBe(1);
        // Verify buffer update
        // @ts-ignore (public)
        expect(functionModeler.symbolicAlignBuffer[functionHash]).toBeDefined();
        // Add checks to validate buffer content if necessary
    });

    it('skips logging if function hash is blacklisted', () => {
        FunctionModeler.storeDataBlacklist.add('blacklistedFuncHash');

        functionModeler.saveSymbolicAlignStatements('blacklistedFuncHash', [1, 2, 3], 'output');
        // @ts-ignore (public)
        expect(functionModeler.dataWorker.logSymbolicAlign).not.toHaveBeenCalled();
    });
})