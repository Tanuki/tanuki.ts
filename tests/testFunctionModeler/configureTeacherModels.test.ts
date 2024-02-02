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

describe('FunctionModeler.configureTeacherModels', () => {
    const funcHash = 'testFuncHash';

    beforeEach(() => {
        // Reset the static properties to ensure a clean slate for each test
        FunctionModeler.teacherModelsOverride = {};
        FunctionModeler.checkFinetuneBlacklist = new Set();
        FunctionModeler.executeFinetuneBlacklist = new Set();
    });



    it('should add new model configuration for a function hash', () => {
        // Assuming DEFAULT_TEACHER_MODELS contains 'existingModelName'
        FunctionModeler.configureTeacherModels(['gpt-4'], funcHash, FunctionType.SYMBOLIC);

        expect(FunctionModeler.teacherModelsOverride[funcHash]).toBeDefined();
        expect(FunctionModeler.teacherModelsOverride[funcHash].length).toBe(1);
        // Further assertions to verify the correctness of the added model config
    });

    it('throws error for unsupported model name', () => {
        const invalidModel = 'invalidModelName';
        expect(() => {
            FunctionModeler.configureTeacherModels([invalidModel], funcHash, FunctionType.SYMBOLIC);
        }).toThrowError(`Teacher model ${invalidModel} not supported by default.`);
    });
})