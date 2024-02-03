import {APIManager} from "../../src/APIManager";
import FunctionModeler from "../../src/functionModeler";
import {IDatasetWorker} from "../../src/trackers/IDatasetWorker";
import {FunctionType} from "../../src/models/functionType";
import {FunctionDescription} from "../../src/models/functionDescription";
import {DEFAULT_DISTILLED_MODEL_NAME, DEFAULT_STUDENT_MODELS, DEFAULT_TEACHER_MODELS} from "../../src/constants";
import {OpenAIAPI} from "../../src/languageModels/openAIAPI";

describe('checkForFinetunes', () => {
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
    it('should return [true, config] when a finetuned model is found', async () => {
            const funcHash = 'funcHash';
            // Mock the apiManager's listFinetuned method to return a finetuned job
            llmMock.listFinetuned = jest.fn().mockResolvedValue([
                {
                    status: 'succeeded',
                    fineTunedModel: {
                        modelName: "finetuned-"+funcHash
                    },
                },
            ]);
            // @ts-ignore (public)
            llmMock.checkApiKey = jest.fn().mockImplementation(() => {/* No operation, preventing exceptions */});

            // Mock apiManagerMock.getProvider to return llmMock when 'openai' is requested
            apiManagerMock.getProvider = jest.fn().mockImplementation((providerName) => {
                if (providerName === 'openai') {
                    return llmMock;
                }
                throw new Error(`Provider ${providerName} not found`);
            });

            const functionDescription: FunctionDescription = {
                name: 'testFunction',
                docstring: 'This is a test function',
                type: FunctionType.SYMBOLIC,
                hash: () => {return funcHash},
            }

            // Create a FunctionModeler instance
            const functionModeler = new FunctionModeler(dataWorkerMock, apiManagerMock);

            // Call checkForFinetunes
            // @ts-ignore (public)
            const [result, config] = await functionModeler.checkForFinetunes(
                functionDescription, 'openai'
            );

            // Assert that the result and config match expectations
            expect(result).toBe(true);
            expect(config).toEqual({
                "distilledModel": {
                    "modelName": "finetuned-funcHash"
                },
                "currentModelStats": {
                    "trainedOnDatapoints": 200,
                    "runningFaults": []
                },
                "lastTrainingRun": {
                    "trainedOnDatapoints": 200
                },
                "currentTrainingRun": {},
                "teacherModels": [],
                "nrOfTrainingRuns": 1
            });
        });


    it('should handle the case when a finetuned model is found but cannot be loaded due to constructConfigFromFinetune throwing an error', async () => {
            const funcHash = 'funcHash';
            // Simulate finding a finetuned model
            llmMock.listFinetuned = jest.fn().mockResolvedValue([
                {
                    status: 'succeeded',
                    fineTunedModel: {
                        modelName: "finetuned-"+funcHash
                    },
                },
            ]);

            // Mock apiManagerMock.getProvider to return llmMock when 'openai' is requested
            apiManagerMock.getProvider = jest.fn().mockImplementation((providerName) => {
                if (providerName === 'openai') {
                    return llmMock;
                }
                throw new Error(`Provider ${providerName} not found`);
            });

            // Assume constructConfigFromFinetune is a method of FunctionModeler for this example
            // Mock it to throw an error to simulate failure in loading the model
            // @ts-ignore (public
            FunctionModeler.prototype.constructConfigFromFinetune = jest.fn().mockImplementation(() => {
                throw new Error('Failed to construct config from finetuned model');
            });

            const functionDescription: FunctionDescription = {
                name: 'testFunction',
                docstring: 'This is a test function',
                type: FunctionType.SYMBOLIC,
                hash: () => {return funcHash},
            }

            // Create a FunctionModeler instance
            const functionModeler = new FunctionModeler(dataWorkerMock, apiManagerMock);

            // @ts-ignore (public)
            const [result, config] = await functionModeler.checkForFinetunes(
                functionDescription, 'openai'
            );

            expect(result).toBe(false);
        });
})