import {FunctionExample} from "../../src/models/functionExample";
import {APIManager} from "../../src/APIManager";
import FunctionModeler from "../../src/functionModeler";
import {IDatasetWorker} from "../../src/trackers/IDatasetWorker";
import {OpenAIAPI} from "../../src/languageModels/openAIAPI";

describe('saveEmbeddableAlignStatements', () => {
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
        functionModeler.updateConfigFile = jest.fn(); // Mock to avoid file system operations
        jest.spyOn(dataWorkerMock, 'logEmbeddableAlign').mockReturnValue([true, false]);
    });

    it('should prepare and save positive and negative pairs correctly', async () => {
        // Setup test case with specific args, positivePairs, and negativePairs
        const functionHash = 'testHash';
        const args = [1, 2, 3];
        const positivePairs: Array<[any[], Record<string, any>]> = new Array([args, {}]);
        const negativePairs:  Array<[any[], Record<string, any>]> = new Array([args, {}]);

        // Call the method under test
        functionModeler.saveEmbeddableAlignStatements(functionHash, args, positivePairs, negativePairs);

        // Assert that dataWorkerMock.logEmbeddableAlign was called with the correct arguments
        expect(dataWorkerMock.logEmbeddableAlign).toHaveBeenCalledWith(
            functionHash,
            expect.any(FunctionExample),
            true
        );
        expect(dataWorkerMock.logEmbeddableAlign).toHaveBeenCalledWith(
            functionHash,
            expect.any(FunctionExample),
            false
        );
    });
})