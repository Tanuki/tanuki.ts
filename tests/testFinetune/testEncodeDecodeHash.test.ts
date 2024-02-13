import FilesystemBufferedLogger from "../../src/trackers/filesystemBufferedLogger";
import FunctionModeler from "../../src/functionModeler";
import {APIManager} from "../../src/APIManager";
import {encodeInt} from "../../src/utils";
import {OpenAIConfig} from "../../src/languageModels/llmConfigs/openAIConfig";
import {FinetuneJob} from "../../src/models/finetuneJob";
import {FunctionDescription} from "../../src/models/functionDescription";
import {FunctionType} from "../../src/models/functionType";

describe('Encode Decode Hash Tests', () => {
    test('test_encode_decode_hash', () => {
        const nrOfTrainingRuns = 5;
        const workspaceId = "12";
        // Assuming dummy_func is defined or translated into TypeScript
        const functionDescription = new FunctionDescription(
            'dummy_func',
            'Dummy function',
            FunctionType.SYMBOLIC,
            'Dummy function hash',
            workspaceId,
            undefined,
            undefined,
            undefined,
            undefined,
        );
        const logger = new FilesystemBufferedLogger('test');
        const funcModeler = new FunctionModeler(logger, new APIManager()); // APIManager needs to be translated or mocked

        // The translation of the hashing and encoding logic will depend on your TypeScript implementation
        // Assuming similar logic exists in TypeScript for hash generation and encoding
        const finetuneHash = 'some_generated_hash' + encodeInt(FunctionModeler.environmentId) + encodeInt(nrOfTrainingRuns);
        const finetune = new FinetuneJob('', '', new OpenAIConfig({
            modelName: `Test_model:__${finetuneHash}:asd[]asd`,
            contextLength: 1200
        }));

        // Similar adjustments for constructing config from finetune
        //@ts-ignore (public)
        const config = funcModeler.constructConfigFromFinetune(finetuneHash.slice(0, -1), finetune);

        expect(config.distilledModel.modelName).toBe(`Test_model:__${finetuneHash}:asd[]asd`);
    });
});
