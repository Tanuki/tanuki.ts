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

describe('checkFinetuningCondition', () => {
    let dataWorkerMock: jest.Mocked<IDatasetWorker>;
    let apiManagerMock: jest.Mocked<APIManager>;
    let llmMock: jest.Mocked<OpenAIAPI>;
    let functionModeler: FunctionModeler;

    const funcHash = 'testFuncHash';
    const defaultConfig: FunctionConfig = {
        nrOfTrainingRuns: 0,
        currentModelStats: {
            trainedOnDatapoints: 0,
            runningFaults: []
        },
        currentTrainingRun: {},
        distilledModel: DEFAULT_STUDENT_MODELS[DEFAULT_DISTILLED_MODEL_NAME],
        teacherModels: [DEFAULT_TEACHER_MODELS.llama_13b_chat_aws],
        lastTrainingRun: {
            trainedOnDatapoints: 0
        }
    };
    const functionDescription: FunctionDescription = {
        name: 'testFunction',
        docstring: 'This is a test function',
        type: FunctionType.SYMBOLIC,
        hash: () => funcHash,
    };

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
        // Mock implementations for methods called within the tests
        functionModeler.checkFinetuningStatus = jest.fn();
        functionModeler.executeFinetuning = jest.fn();
        // @ts-ignore (public)
        functionModeler.functionConfigs = {};
        // @ts-ignore (public)
        functionModeler.datasetSizes = {SYMBOLIC_ALIGNMENTS: {}, PATCHES: {}};
    });

    it('should return false if finetuning conditions are not met', () => {
        // @ts-ignore (public)
        functionModeler.functionConfigs[funcHash] = defaultConfig;
        // No dataset sizes set, implying conditions are not met
        // @ts-ignore (public)
        const conditionMet = functionModeler.checkFinetuningCondition(funcHash, functionDescription);

        expect(conditionMet).toBe(false);
    });

    it('should return true if finetuning conditions are met', () => {
        // @ts-ignore (public)
        functionModeler.functionConfigs[funcHash] = defaultConfig;
        // @ts-ignore (public)
        functionModeler.datasetSizes.SYMBOLIC_ALIGNMENTS[funcHash] = 300;
        // @ts-ignore (public)
        functionModeler.datasetSizes.PATCHES[funcHash] = 200; // Default threshold is 200
        // @ts-ignore (public)
        const conditionMet = functionModeler.checkFinetuningCondition(funcHash, functionDescription);

        expect(conditionMet).toBe(true);
    });
})