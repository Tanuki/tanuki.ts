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

describe('saveContrastiveAlignmentPair', () => {
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
    });

    it('should call logEmbeddableAlign and update dataset sizes correctly for positive alignments', () => {
        // Setup
        const functionHash = 'testHash';
        const args = [1, 2, 3];
        const pair: [any[], Record<string, any>] = [[4, 5, 6], {}];
        const positive = true;

        // Mock logEmbeddableAlign to simulate successful save
        dataWorkerMock.logEmbeddableAlign.mockReturnValue([true, true]);

        // Action
        // @ts-ignore (public)
        functionModeler.saveContrastiveAlignmentPair(functionHash, args, pair, positive);

        // Assert
        expect(dataWorkerMock.logEmbeddableAlign).toHaveBeenCalledWith(functionHash, expect.any(Object), positive);

        // Assuming you have a way to check updates to datasetSizes, e.g., a public getter or directly accessing the property
        // This is a hypothetical example; adjust according to your actual implementation
        // @ts-ignore (public)
        expect(functionModeler.datasetSizes['POSITIVE_EMBEDDABLE_ALIGNMENTS'][functionHash]).toBeDefined();
        // @ts-ignore (public)
        expect(functionModeler.datasetSizes['POSITIVE_EMBEDDABLE_ALIGNMENTS'][functionHash]).toBeGreaterThan(0);
    });
})