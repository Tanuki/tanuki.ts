import {APIManager} from "../../src/APIManager";
import FunctionModeler from "../../src/functionModeler";
import {IDatasetWorker} from "../../src/trackers/IDatasetWorker";
import {FunctionType} from "../../src/models/functionType";
import {FunctionDescription} from "../../src/models/functionDescription";
import {DEFAULT_DISTILLED_MODEL_NAME, DEFAULT_STUDENT_MODELS, DEFAULT_TEACHER_MODELS} from "../../src/constants";
import {FunctionConfig} from "../../src/models/functionConfig";
describe('executeFinetuning', () => {
    let functionModeler: FunctionModeler;
    // Mock dataset information with stringified JSON FunctionExample objects
    const alignDatasetExamples = [{example: 'align1'}, {example: 'align2'}].map(e => JSON.stringify(e)).join('\n') + '\n';
    const patchDatasetExamples = [{example: 'patch1'}, {example: 'patch2'}].map(e => JSON.stringify(e)).join('\n') + '\n';
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
    let dataWorkerMock: jest.Mocked<IDatasetWorker>;
    let apiManagerMock: jest.Mocked<APIManager>;
    let finetuneMock: jest.Mock;

    beforeAll(() => {
        global.console = {
            ...console,
            error: jest.fn(),
        };
    });

    afterAll(() => {
        // Restore console.error if needed
        // @ts-ignore
        global.console.error.mockRestore();
    });

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
        // llmMock = new OpenAIAPI() as jest.Mocked<OpenAIAPI>;
        apiManagerMock = new APIManager() as jest.Mocked<APIManager>;
        // apiManagerMock.getProvider = jest.fn().mockImplementation(() => ({
        //     finetune: jest.fn().mockResolvedValue({ id: 'finetuneJobId' }),
        // }));
        finetuneMock = jest.fn().mockResolvedValue({ id: 'finetuneJobId' });
        apiManagerMock.getProvider = jest.fn().mockReturnValue({ finetune: finetuneMock });

        functionModeler = new FunctionModeler(dataWorkerMock, apiManagerMock);
        // Setup mocks
        // @ts-ignore (public)
        functionModeler.getDatasetInfo = jest.fn();
        // @ts-ignore (public)
        functionModeler.updateConfigFile = jest.fn();
        // @ts-ignore (public)
        functionModeler.functionConfigs = {
            [funcHash]: defaultConfig
        };
        // @ts-ignore (public)
        functionModeler.datasetSizes = {
            SYMBOLIC_ALIGNMENTS: { [funcHash]: 100 },
            PATCHES: { [funcHash]: 200 },
        };
    });

    it('should submit a finetuning job with the correct parameters', async () => {

        // @ts-ignore (public)
        functionModeler.getDatasetInfo.mockReturnValueOnce(alignDatasetExamples).mockReturnValueOnce(patchDatasetExamples);

        await functionModeler.executeFinetuning(functionDescription, funcHash);

        // Verify finetune was called with the expected parameters
        // @ts-ignore (protected)
        expect(finetuneMock).toHaveBeenCalled();
        // @ts-ignore (protected)
        expect(functionModeler.updateConfigFile).toHaveBeenCalledWith(funcHash);
        // @ts-ignore (protected)
        expect(functionModeler.functionConfigs[funcHash].currentTrainingRun).toBeDefined();
    });

    it('should handle errors during the finetuning process', async () => {
        // Setup to throw an error during finetune call
        const errorMessage = 'Finetuning failed';
        // @ts-ignore (protected)
        functionModeler.apiManager.getProvider = jest.fn().mockImplementation(() => ({
            finetune: jest.fn().mockRejectedValue(new Error(errorMessage)),
        }));

        // @ts-ignore (public)
        functionModeler.getDatasetInfo.mockReturnValueOnce(alignDatasetExamples).mockReturnValueOnce(patchDatasetExamples);

        await functionModeler.executeFinetuning(functionDescription, funcHash);

        // Verify error handling
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining(errorMessage));
    });
});
