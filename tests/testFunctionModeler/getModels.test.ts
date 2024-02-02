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

describe('getModels', () => {
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
    describe('getModels', () => {
        it('returns models from existing configuration', async () => {
            const funcHash = 'funcHash';
            const functionDescription: FunctionDescription = {
                name: 'testFunction',
                docstring: 'This is a test function',
                type: FunctionType.SYMBOLIC,
                hash: () => funcHash,
            }
            const existingConfig = {
                distilledModel: DEFAULT_STUDENT_MODELS[DEFAULT_DISTILLED_MODEL_NAME],
                teacherModels: [DEFAULT_TEACHER_MODELS.llama_13b_chat_aws],
                currentModelStats: {
                    trainedOnDatapoints: 0,
                    runningFaults: []
                }
            }
            // Prepopulate functionConfigs
            // @ts-ignore (public)
            functionModeler.functionConfigs[funcHash] = existingConfig

            const [distilledModel, teacherModels] = await functionModeler.getModels(functionDescription);

            expect(distilledModel).toEqual(existingConfig.distilledModel);
            expect(teacherModels).toEqual(existingConfig.teacherModels);
        });
    })
})