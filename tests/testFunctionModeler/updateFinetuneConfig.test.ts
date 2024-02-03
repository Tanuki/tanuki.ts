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
import {FinetuneJob} from "../../src/models/finetuneJob";

describe('updateFinetuneConfig', () => {
    let dataWorkerMock: jest.Mocked<IDatasetWorker>;
    let apiManagerMock: jest.Mocked<APIManager>;
    let functionModeler: FunctionModeler;
    const funcHash = 'testFuncHash';
    const functionDescription = {
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
        functionModeler = new FunctionModeler(dataWorkerMock, apiManagerMock);

        // @ts-ignore (public)
        functionModeler.functionConfigs = {
            [funcHash]: {
                distilledModel: DEFAULT_STUDENT_MODELS[DEFAULT_DISTILLED_MODEL_NAME],
                currentTrainingRun: {
                    trainedOnDatapoints: 200, // Example initial value
                },
                nrOfTrainingRuns: 0,
                teacherModels: [DEFAULT_TEACHER_MODELS.llama_13b_chat_aws],
                currentModelStats: {
                    trainedOnDatapoints: 200, // Example initial value
                    runningFaults: [],
                },
                lastTrainingRun: {
                    trainedOnDatapoints: 100, // Example initial value
                },
            }
        }
        // @ts-ignore (public)
        functionModeler.updateConfigFile = jest.fn();
        global.console.info = jest.fn();
        global.console.error = jest.fn();
    });

    it('should reset current training run on failed finetuning job', () => {
        const response: FinetuneJob = { status: 'failed', id: 'jobId123', fineTunedModel: DEFAULT_STUDENT_MODELS[DEFAULT_DISTILLED_MODEL_NAME] };

        // @ts-ignore (private)
        functionModeler.updateFinetuneConfig(response, funcHash, functionDescription);

        // @ts-ignore (private)
        expect(functionModeler.functionConfigs[funcHash].currentTrainingRun).toEqual({});
        expect(console.info).toHaveBeenCalledWith(expect.stringContaining('finished with status: failed'));
    });

    it('should update config on successful finetuning job', () => {
        const fineTunedModel = DEFAULT_STUDENT_MODELS[DEFAULT_DISTILLED_MODEL_NAME];
        const response: FinetuneJob = { status: 'succeeded', fineTunedModel: fineTunedModel,  id: 'jobId123' };

        // @ts-ignore (private)
        functionModeler.updateFinetuneConfig(response, funcHash, functionDescription);

        // @ts-ignore (public)
        expect(functionModeler.functionConfigs[funcHash].distilledModel).toBe(fineTunedModel);
        // @ts-ignore (public)
        expect(functionModeler.functionConfigs[funcHash].lastTrainingRun.trainedOnDatapoints).toEqual(200);
        // @ts-ignore (public)
        expect(functionModeler.functionConfigs[funcHash].currentModelStats.trainedOnDatapoints).toEqual(200);
        // @ts-ignore (public)
        expect(functionModeler.functionConfigs[funcHash].nrOfTrainingRuns).toEqual(1);
        expect(console.info).toHaveBeenCalledWith(expect.stringContaining('finished with status: succeeded'));
    });

    it('should log an error if updateConfigFile fails', () => {
        const response = { status: 'succeeded', fineTunedModel: DEFAULT_STUDENT_MODELS[DEFAULT_DISTILLED_MODEL_NAME]  };

        // @ts-ignore (public)
        functionModeler.updateConfigFile = jest.fn().mockImplementation(() => {
            throw new Error('Update failed');
        });

        // @ts-ignore (public)
        functionModeler.updateFinetuneConfig(response, funcHash, functionDescription);

        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Could not update the function configuration file'));
    });
})