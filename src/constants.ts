import { OpenAIConfig } from "./languageModels/llmConfigs/openAIConfig";
import { ClaudeConfig } from "./languageModels/llmConfigs/claudeConfig";
import { LlamaBedrockConfig } from "./languageModels/llmConfigs/llamaConfig";
import { TitanBedrockConfig } from "./languageModels/llmConfigs/titanConfig";

export const EXAMPLE_ELEMENT_LIMIT = 1000

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
export const POSITIVE_FILE_EXTENSION: POSITIVE_FILE_EXTENSION_TYPE = '.positive'

export const NEGATIVE_EMBEDDABLE_ALIGNMENTS = 'negative';
export type NEGATIVE_FILE_EXTENSION_TYPE = '.negative';
export const NEGATIVE_FILE_EXTENSION: NEGATIVE_FILE_EXTENSION_TYPE = '.negative';

// Bloom filter default config
export const EXPECTED_ITEMS = 10000
export const FALSE_POSITIVE_RATE = 0.01

// The name of the library
export const LIB_NAME = 'tanuki';
export const ENVVAR = 'TANUKI_LOG_DIR';

// default models
export const DEFAULT_TEACHER_MODEL_NAMES = ["gpt-4", "gpt-4-32k", ]
export const DEFAULT_DISTILLED_MODEL_NAME = "gpt-3.5-finetune"
export const DEFAULT_EMBEDDING_MODEL_NAME = "ada-002"

// provider names
export const OPENAI_PROVIDER = "openai"
export const BEDROCK_PROVIDER = "bedrock"
export const LLAMA_BEDROCK_PROVIDER = "llama_bedrock"
export const TITAN_BEDROCK_PROVIDER = "aws_titan_bedrock"

// model type strings
export const TEACHER_MODEL = "teacher"
export const DISTILLED_MODEL = "distillation"
export const DEFAULT_GENERATIVE_MODELS = {
  "gpt-4-1106-preview": new OpenAIConfig({modelName: "gpt-4-1106-preview", contextLength: 128000}),
  "gpt-4": new OpenAIConfig({modelName: "gpt-4", contextLength: 8192}),
  "gpt-4-32k": new OpenAIConfig({modelName: "gpt-4-32k", contextLength: 32768}),
  "gpt-3.5-finetune": new OpenAIConfig({modelName: "", contextLength: 3000}),
  "anthropic.claude-v2:1": new ClaudeConfig({modelName: "anthropic.claude-v2:1", contextLength: 200000}),
  "llama_70b_chat_aws": new LlamaBedrockConfig({modelName: "meta.llama2-70b-chat-v1", contextLength: 4096}),
  "llama_13b_chat_aws": new LlamaBedrockConfig({modelName: "meta.llama2-13b-chat-v1", contextLength: 4096}),
}


export const DEFAULT_EMBEDDING_MODELS = {
  "ada-002": new OpenAIConfig({modelName:"text-embedding-ada-002", contextLength:8191}),
  "aws_titan_embed_v1": new TitanBedrockConfig({modelName:"amazon.titan-embed-text-v1", contextLength:8000}),
}