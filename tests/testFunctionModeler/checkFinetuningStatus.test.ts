import {APIManager} from "../../src/APIManager";
import FunctionModeler from "../../src/functionModeler";
import {IDatasetWorker} from "../../src/trackers/IDatasetWorker";
import {FunctionType} from "../../src/models/functionType";
import {FunctionDescription} from "../../src/models/functionDescription";
import {DEFAULT_DISTILLED_MODEL_NAME, DEFAULT_STUDENT_MODELS, DEFAULT_TEACHER_MODELS} from "../../src/constants";
describe('checkFinetuningStatus', () => {
    let functionModeler: FunctionModeler;
    // Mock dataset information with stringified JSON FunctionExample objects
    const funcHash = 'testFuncHash';
    const functionDescription: FunctionDescription = {
        name: 'testFunction',
        docstring: 'This is a test function',
        type: FunctionType.SYMBOLIC,
        hash: () => funcHash,
    };
    let dataWorkerMock: jest.Mocked<IDatasetWorker>;
    let apiManagerMock: jest.Mocked<APIManager>;

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
        functionModeler = new FunctionModeler(dataWorkerMock, apiManagerMock);
        // @ts-ignore (public)
        functionModeler.apiManager = {
            getProvider: jest.fn().mockImplementation(() => ({
                getFinetuned: jest.fn().mockResolvedValue({
                    status: 'succeeded', // Mock default response; override in specific tests
                }),
                finetune: jest.fn().mockResolvedValue({
                    jobId: 'jobId123',
                }),
            })),
        };
        // @ts-ignore (public)
        functionModeler.updateFinetuneConfig = jest.fn();
        // @ts-ignore (public)
        functionModeler.updateConfigFile = jest.fn();
        // @ts-ignore (public)
        functionModeler.functionConfigs = {
            [funcHash]: {
                lastTrainingRun: {
                    trainedOnDatapoints: 0,
                },
                nrOfTrainingRuns: 0,
                distilledModel: DEFAULT_STUDENT_MODELS[DEFAULT_DISTILLED_MODEL_NAME],
                teacherModels: [DEFAULT_TEACHER_MODELS.llama_13b_chat_aws],
                currentModelStats: {
                    trainedOnDatapoints: 0,
                    runningFaults: [],
                },
                currentTrainingRun: {
                    jobId: 'jobId123',
                    lastChecked: undefined, // Set this dynamically in tests
                },
            },
        };
    });

    it('should return early if there is no current training run', async () => {
        //@ts-ignore (public)
        functionModeler.functionConfigs[funcHash].currentTrainingRun = {

        };
        await functionModeler.checkFinetuningStatus(funcHash, functionDescription);
        //@ts-ignore (public)
        expect(functionModeler.apiManager.getProvider).not.toHaveBeenCalled();
    });

    it('should check finetuning status if 30 minutes have passed since lastChecked', async () => {
        // Set lastChecked to 31 minutes ago
        const lastChecked = new Date(Date.now() - 31 * 60 * 1000).toISOString();
        //@ts-ignore (public)
        functionModeler.functionConfigs[funcHash].currentTrainingRun.lastChecked = lastChecked;

        const getFinetunedMock = jest.fn().mockResolvedValue({
            id : 'jobId123',
            status: 'succeeded',
            fineTunedModel: DEFAULT_STUDENT_MODELS[DEFAULT_DISTILLED_MODEL_NAME]
        });
        // @ts-ignore (public)
        functionModeler.apiManager.getProvider = jest.fn().mockReturnValue({
            getFinetuned: getFinetunedMock
        });

        await functionModeler.checkFinetuningStatus(funcHash, functionDescription);
        //@ts-ignore (public)
        expect(getFinetunedMock).toHaveBeenCalledWith('jobId123');
    });

    it('should handle API call failure gracefully', async () => {
        // Set lastChecked to 31 minutes ago
        const lastChecked = new Date(Date.now() - 31 * 60 * 1000).toISOString();
        //@ts-ignore (public)
        functionModeler.functionConfigs[funcHash].currentTrainingRun.lastChecked = lastChecked;

        // @ts-ignore (public)
        functionModeler.apiManager.getProvider = jest.fn().mockReturnValue({
            getFinetuned: jest.fn().mockRejectedValue(new Error('Error checking finetuning status')),
        });

        await functionModeler.checkFinetuningStatus(funcHash, functionDescription);
        expect(console.error).toHaveBeenCalledWith(expect.stringMatching('Error checking finetuning status'), expect.anything());

    });
});