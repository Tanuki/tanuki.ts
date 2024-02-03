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

describe('setConfig', () => {
    const functionHash = 'uniqueFunctionHash';
    const functionDescription: FunctionDescription = {
        name: 'testFunction',
        docstring: 'This is a test function',
        type: FunctionType.SYMBOLIC,
        hash: () => functionHash,
    };

    beforeEach(() => {
        // Reset blacklist sets
        FunctionModeler.executeFinetuneBlacklist = new Set();
        FunctionModeler.checkFinetuneBlacklist = new Set();
        FunctionModeler.storeDataBlacklist = new Set();

    });


    it('updates blacklists and environmentId based on config', () => {
        const config: PatchConfig = {
            environmentId: 123,
            ignoreFinetuning: true,
            ignoreFinetuneFetching: true,
            ignoreDataStorage: true,
        };

        FunctionModeler.setConfig(functionDescription, config);

        expect(FunctionModeler.executeFinetuneBlacklist.has(functionHash)).toBe(true);
        expect(FunctionModeler.checkFinetuneBlacklist.has(functionHash)).toBe(true);
        expect(FunctionModeler.storeDataBlacklist.has(functionHash)).toBe(true);
        expect(FunctionModeler.environmentId).toBe(123);
    });
})