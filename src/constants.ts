import { OpenAIConfig } from './languageModels/llmConfigs/openAIConfig';
import { ClaudeConfig } from './languageModels/llmConfigs/claudeConfig';
import { LlamaBedrockConfig } from './languageModels/llmConfigs/llamaConfig';
import { TitanBedrockConfig } from './languageModels/llmConfigs/titanConfig';
import { TogetherAIConfig } from './languageModels/llmConfigs/togetherAIConfig';
export const EXAMPLE_ELEMENT_LIMIT = 1000;

// These represent the file extensions for the symbolic patch and alignment datasets
export const PATCHES = 'patches';
export type PATCH_FILE_EXTENSION_TYPE = '.patches';
export const PATCH_FILE_EXTENSION: PATCH_FILE_EXTENSION_TYPE = '.patches';

export const SYMBOLIC_ALIGNMENTS = 'alignments';
export type ALIGN_FILE_EXTENSION_TYPE = '.alignments';
export const ALIGN_FILE_EXTENSION: ALIGN_FILE_EXTENSION_TYPE = '.alignments';

// These represent the file extensions for the embeddable examples positive and negative datasets
export const POSITIVE_EMBEDDABLE_ALIGNMENTS = 'positive';
export type POSITIVE_FILE_EXTENSION_TYPE = '.positive';
export const POSITIVE_FILE_EXTENSION: POSITIVE_FILE_EXTENSION_TYPE =
  '.positive';

export const NEGATIVE_EMBEDDABLE_ALIGNMENTS = 'negative';
export type NEGATIVE_FILE_EXTENSION_TYPE = '.negative';
export const NEGATIVE_FILE_EXTENSION: NEGATIVE_FILE_EXTENSION_TYPE =
  '.negative';

export const REGISTERED_FUNCTIONS_FILENAME = 'functions.jsonl';
// Bloom filter default config
export const EXPECTED_ITEMS = 1000000;
export const FALSE_POSITIVE_RATE = 0.01;

// The name of the library
export const LIB_NAME = 'tanuki';
export const ENVVAR = 'TANUKI_LOG_DIR';

// default models
export const DEFAULT_TEACHER_MODEL_NAMES = ['gpt-4', 'gpt-4-32k'];
export const DEFAULT_DISTILLED_MODEL_NAME = 'gpt-3.5-turbo-1106';
export const DEFAULT_EMBEDDING_MODEL_NAME = 'ada-002';

// provider names
export const OPENAI_PROVIDER = 'openai';
export const BEDROCK_PROVIDER = 'bedrock';
export const LLAMA_BEDROCK_PROVIDER = 'llama_bedrock';
export const TITAN_BEDROCK_PROVIDER = 'aws_titan_bedrock';
export const TOGETHER_AI_PROVIDER = 'together_ai';
// model type strings
export const TEACHER_MODEL = 'teacher';
export const DISTILLED_MODEL = 'distillation';
export const DEFAULT_TEACHER_MODELS = {
  'gpt-4-1106-preview': new OpenAIConfig({
    modelName: 'gpt-4-1106-preview',
    contextLength: 128000,
  }),
  'gpt-4': new OpenAIConfig({ modelName: 'gpt-4', contextLength: 8192 }),
  'gpt-4-32k': new OpenAIConfig({
    modelName: 'gpt-4-32k',
    contextLength: 32768,
  }),
  'gpt-4-turbo': new OpenAIConfig({
    modelName: 'gpt-4-1106-preview',
    contextLength: 128000,
    instructions:
      'You are given below a function description and input data. The function description of what the function must carry out can be found in the Function section, with input and output type hints. The input data can be found in Input section. Using the function description, apply the function to the Input and return a valid output type, that is acceptable by the output_class_definition and output_class_hint.\nINCREDIBLY IMPORTANT: Only output a JSON-compatible string in the correct response format. Use the [END] tokens to specify when the output ends.',
    parsingHelperTokens: { startToken: '[START]', endToken: '[END]' },
  }),
  'gpt-4-turbo-0125': new OpenAIConfig({
    modelName: 'gpt-4-0125-preview',
    contextLength: 128000,
    instructions:
      'You are given below a function description and input data. The function description of what the function must carry out can be found in the Function section, with input and output type hints. The input data can be found in Input section. Using the function description, apply the function to the Input and return a valid output type, that is acceptable by the output_class_definition and output_class_hint.\nINCREDIBLY IMPORTANT: Only output a JSON-compatible string in the correct response format. Use the [END] tokens to specify when the output ends.',
    parsingHelperTokens: { startToken: '[START]', endToken: '[END]' },
  }),
  'gpt-3.5-turbo-1106-finetune': new OpenAIConfig({
    modelName: '',
    contextLength: 14000,
  }),
  'anthropic.claude-v2:1': new ClaudeConfig({
    modelName: 'anthropic.claude-v2:1',
    contextLength: 200000,
  }),
  llama_70b_chat_aws: new LlamaBedrockConfig({
    modelName: 'meta.llama2-70b-chat-v1',
    contextLength: 4096,
  }),
  llama_13b_chat_aws: new LlamaBedrockConfig({
    modelName: 'meta.llama2-13b-chat-v1',
    contextLength: 4096,
  }),
  'Mixtral-8x7B': new TogetherAIConfig({
    modelName: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
    chatTemplate: '{user_prompt}', // for some reason this worked better than using their own supplied chat template
    contextLength: 32768,
  }),
  'OpenHermes-2p5-Mistral': new TogetherAIConfig({
    modelName: 'mistralai/OpenHermes-2p5-Mistral-7B',
    contextLength: 32768,
  }),
  'llama13b-togetherai': new TogetherAIConfig({
    modelName: 'togethercomputer/llama-2-13b-chat',
    contextLength: 4096,
  }),
  'openchat-3.5': new TogetherAIConfig({
    modelName: 'openchat/openchat-3.5-1210',
    contextLength: 4096,
  }),
  'Mixtral-8x7B-DPO': new TogetherAIConfig({
    modelName: 'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO',
    contextLength: 32768,
  }),
  'Yi-34B-Chat': new TogetherAIConfig({
    modelName: 'zero-one-ai/Yi-34B-Chat',
    contextLength: 4096,
  }),
  'Mistral-7B-Instruct-v0.2': new TogetherAIConfig({
    modelName: 'mistralai/Mistral-7B-Instruct-v0.2',
    contextLength: 32768,
  }),
};

export const DEFAULT_STUDENT_MODELS = {
  'gpt-3.5-turbo-1106': new OpenAIConfig({
    modelName: '',
    contextLength: 14000,
  }),
};

export const DEFAULT_EMBEDDING_MODELS = {
  'ada-002': new OpenAIConfig({
    modelName: 'text-embedding-ada-002',
    contextLength: 8191,
  }),
  aws_titan_embed_v1: new TitanBedrockConfig({
    modelName: 'amazon.titan-embed-text-v1',
    contextLength: 8000,
  }),
};
