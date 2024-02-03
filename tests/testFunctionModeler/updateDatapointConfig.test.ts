import {APIManager} from "../../src/APIManager";
import FunctionModeler from "../../src/functionModeler";
import {IDatasetWorker} from "../../src/trackers/IDatasetWorker";
import {DEFAULT_DISTILLED_MODEL_NAME, DEFAULT_STUDENT_MODELS, DEFAULT_TEACHER_MODELS} from "../../src/constants";
import {OpenAIAPI} from "../../src/languageModels/openAIAPI";

describe('updateDatapointConfig', () => {
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
        it('should add fault value correctly and maintain fault history', () => {
            // Simulate 50 successful repairs (1) and 50 faults (0)
            for (let i = 0; i < 50; i++) {
                functionModeler.updateDatapointConfig(true, "testFuncHash");
                functionModeler.updateDatapointConfig(false, "testFuncHash");
            }
            // @ts-ignore (public)
            expect(functionModeler.functionConfigs["testFuncHash"].currentModelStats.runningFaults.length).toBe(100);
            // @ts-ignore (public)
            expect(functionModeler.functionConfigs["testFuncHash"].currentModelStats.runningFaults.slice(-1)[0]).toBe(0);
        });

        it('should clear model config if recent fault rate exceeds 50%', () => {
            // Simulate 9 successful repairs followed by 1 fault to exceed fault rate
            for (let i = 0; i < 9; i++) {
                functionModeler.updateDatapointConfig(true, "testFuncHash");
            }
            functionModeler.updateDatapointConfig(false, "testFuncHash");

            // @ts-ignore (public)
            expect(functionModeler.functionConfigs["testFuncHash"].distilledModel.modelName).toBe('');
            // @ts-ignore (public)
            expect(functionModeler.functionConfigs["testFuncHash"].currentModelStats.trainedOnDatapoints).toBe(0);
            // @ts-ignore (public)
            expect(functionModeler.functionConfigs["testFuncHash"].currentModelStats.runningFaults.length).toBe(4);
        });

        it('should handle updateConfigFile failure gracefully', () => {
            // Simulate an error in updateConfigFile

            // @ts-ignore (public)
            functionModeler.updateConfigFile.mockImplementation(() => {
                throw new Error('Failed to update config file');
            });

            expect(() => {
                functionModeler.updateDatapointConfig(true, "testFuncHash");
            }).not.toThrow();
        });
})