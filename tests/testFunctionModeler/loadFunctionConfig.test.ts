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

describe('loadFunctionConfig', () => {
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

    it('returns existing configuration if available', async () => {
        // Setup mock for dataWorker.loadFunctionConfig to return a pre-existing config
        // and mock for checkForFinetunes to simulate a finetuning scenario

        const functionHash = 'existingFuncHash';
        const functionDescription: FunctionDescription = {
            name: 'testFunction',
            docstring: 'This is a test function',
            type: FunctionType.SYMBOLIC,
            hash: () => functionHash,
        }
        const existingConfig = {
            distilledModel: DEFAULT_STUDENT_MODELS[DEFAULT_DISTILLED_MODEL_NAME],
            teacherModels: [DEFAULT_TEACHER_MODELS.llama_13b_chat_aws],
            currentModelStats: {
                trainedOnDatapoints: 0,
                runningFaults: []
            }
        }
        // @ts-ignore
        jest.spyOn(functionModeler, 'checkForFinetunes');
        // @ts-ignore (public)
        functionModeler.dataWorker.loadFunctionConfig.mockReturnValue([existingConfig, false]);

        const config = await functionModeler.loadFunctionConfig(functionHash, functionDescription);

        expect(config).toEqual(existingConfig);
        // Verify no finetune check is made for existing configuration
        // @ts-ignore
        expect(functionModeler.checkForFinetunes).not.toHaveBeenCalled();
    });
    // Check for finetunes if `defaultUsed` is true
    it('checks for finetunes if default model was used', async () => {
        const functionHash = 'newFuncHash';
        const functionDescription: FunctionDescription = {
            name: 'testFunction',
            docstring: 'This is a test function',
            type: FunctionType.SYMBOLIC,
            hash: () => functionHash,
        }
        const existingConfig = {
            distilledModel: DEFAULT_STUDENT_MODELS[DEFAULT_DISTILLED_MODEL_NAME],
            teacherModels: [DEFAULT_TEACHER_MODELS.llama_13b_chat_aws],
            currentModelStats: {
                trainedOnDatapoints: 0,
                runningFaults: []
            }
        }
        // @ts-ignore (public)
        functionModeler.dataWorker.loadFunctionConfig.mockReturnValue([existingConfig, true]);

        await expect(functionModeler.loadFunctionConfig(functionHash, functionDescription))
            .rejects.toThrow('OpenAI API key is not set');
    })

})