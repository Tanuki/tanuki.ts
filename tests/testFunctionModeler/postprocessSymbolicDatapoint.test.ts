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

describe('postprocessSymbolicDatapoint', () => {
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
        apiManagerMock = new APIManager() as jest.Mocked<APIManager>;
        functionModeler = new FunctionModeler(dataWorkerMock, apiManagerMock);

        // @ts-ignore
        functionModeler.functionConfigs = {"validHash": {
                    distilledModel: DEFAULT_STUDENT_MODELS[DEFAULT_DISTILLED_MODEL_NAME],
                    teacherModels: [DEFAULT_TEACHER_MODELS.llama_13b_chat_aws],
                    currentModelStats: {
                        trainedOnDatapoints: 0,
                        runningFaults: []
                    }
            }
        }
    });

    it('processes and updates config for a new symbolic datapoint', async () => {
        const funcHash = 'validHash';
        const example = { args: [1, 2, 3], output: 6 };
        const functionDescription = {
            name: 'testFunction',
            docstring: 'This is a test function',
            type: FunctionType.SYMBOLIC,
            hash: () => funcHash,
        }
        // Assume saveSymbolicDatapoint returns true indicating a datapoint was added
        jest.spyOn(functionModeler, 'saveSymbolicDatapoint').mockReturnValue(true);
        jest.spyOn(functionModeler, 'checkForFinetuning');

        await functionModeler.postprocessSymbolicDatapoint(funcHash, functionDescription, example);

        expect(functionModeler.saveSymbolicDatapoint).toHaveBeenCalledWith(funcHash, example);
        // Verify updateDatapointConfig and checkForFinetuning are called appropriately
        // @ts-ignore
        expect(dataWorkerMock.updateFunctionConfig).toHaveBeenCalledWith(funcHash, functionModeler.functionConfigs[funcHash]);
        expect(functionModeler.checkForFinetuning).toHaveBeenCalledWith(functionDescription, funcHash);
    });
})