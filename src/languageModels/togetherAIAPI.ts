import LLMApi from './LLMApi';
import { TogetherAIConfig } from './llmConfigs/togetherAIConfig';
import LLMFinetuneAPI from './LLMFinetuneAPI';
import { FinetuneJob } from '../models/finetuneJob';
import {Inferable} from "../APIManager";
import {BaseModelConfig} from "./llmConfigs/baseModelConfig";

// Assuming you have similar configurations as in the Python code
const TOGETHER_AI_URL = 'https://api.together.xyz/inference';
const LLM_GENERATION_PARAMETERS = [
  'temperature',
  'top_p',
  'max_new_tokens',
  'frequency_penalty',
  'presence_penalty',
];

interface ModelInstanceConfig {
  appearsIn: any[];
  order: number;
}

interface Config {
  stop: string[];
  prompt_format: string;
  chat_template: string;
}

interface Pricing {
  input: number;
  output: number;
  hourly: number;
}

interface Instance {
  avzone: string;
  cluster: string;
}

interface DepthPrice {
  base: number;
  finetune: number;
  hourly: number;
  input: number;
  output: number;
}

interface DepthStat {
  avzone: string;
  cluster: string;
  capacity: number;
  qps: number;
  throughput_in: number;
  throughput_out: number;
  error_rate: number;
  retry_rate: number;
}

interface Depth {
  num_asks: number;
  num_bids: number;
  num_running: number;
  asks: Record<string, number>;
  asks_updated: string;
  gpus: Record<string, number>;
  qps: number;
  permit_required: boolean;
  price: DepthPrice;
  throughput_in: number;
  throughput_out: number;
  stats: DepthStat[];
}

interface ModelInfo {
  modelInstanceConfig: ModelInstanceConfig;
  _id: string;
  name: string;
  display_name: string;
  display_type: string;
  description: string;
  license: string;
  creator_organization: string;
  hardware_label: string;
  num_parameters: number;
  show_in_playground: boolean;
  isFeaturedModel: boolean;
  context_length: number;
  config: Config;
  pricing: Pricing;
  created_at: string;
  update_at: string;
  instances: Instance[];
  access: string;
  link: string;
  descriptionLink: string;
  depth: Depth;
}

export class TogetherAIAPI implements Inferable {
  private apiKey: string | undefined;
  private modelConfigs: Record<string, ModelInfo>;

  constructor() {
    this.apiKey = process.env.TOGETHER_API_KEY;
    this.modelConfigs = {};
  }

  public async generate(
    model: BaseModelConfig,
    systemMessage: string,
    prompt: string,
    kwargs: {
      temperature?: number;
      topP?: number;
      frequencyPenalty?: number;
      presencePenalty?: number;
      maxNewTokens?: number;
      stop?: string;
    } = {}
  ): Promise<string> {
    this.checkApiKey();
    const modelName = typeof model === 'string' ? model : model.modelName;
    // Retrieving model configuration
    if (!this.modelConfigs[modelName]) {
      // Assuming `together.Models.info` is similar to OpenAI client usage
      // You might need to adjust this part based on your actual implementation
      this.modelConfigs[modelName] = await this.fetchModelInfo(
        modelName
      );

    }


    const generationParams: {
      temperature: number;
      topP: number;
      repetition_penalty: number;
      presencePenalty: number;
      maxNewTokens?: number;
      stop?: string[];
    } = {
      temperature: kwargs.temperature || 0.1,
      topP: kwargs.topP || 1,
      repetition_penalty: kwargs.frequencyPenalty || 0,
      presencePenalty: kwargs.presencePenalty || 0,
      maxNewTokens: kwargs.maxNewTokens,
    };

    if ('stop' in this.modelConfigs[modelName].config) {
      generationParams.stop = this.modelConfigs[modelName].config.stop;
    }
    if (model.parsingHelperTokens?.endToken) {
      generationParams.stop = [model.parsingHelperTokens.endToken];
    }
    const unsupportedParams = Object.keys(kwargs).filter(
      param => !LLM_GENERATION_PARAMETERS.includes(param)
    );
    if (unsupportedParams.length > 0) {
      console.warn(
        `Unused generation parameters sent as input: (${unsupportedParams.join(
          ', '
        )}). Only the following parameters are supported: [${LLM_GENERATION_PARAMETERS.join(
          ', '
        )}]`
      );
    }

    const requestParams = {
      model: modelName,
      ...generationParams,
      prompt: this.formatPrompt(model, systemMessage, prompt),
    };

    let choice = '';
    let retryCount = 0;
    const maxRetries = 5;

    while (retryCount <= maxRetries) {
      try {
        const response = await fetch(TOGETHER_AI_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestParams),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = (await response.json()) as {
          output: { choices: { text: string }[] };
        };
        choice = data.output.choices[0].text.trim();
        break;
      } catch (error: any) {
        if (retryCount === maxRetries) {
          throw new Error(
            `Together AI API failed to generate a response: ${
              (error as { message: string }).message
            }`
          );
        }
        retryCount++;
        await new Promise(resolve =>
          setTimeout(resolve, Math.pow(2, retryCount) * 1000)
        );
      }
    }

    if (!choice) {
      throw new Error('TogetherAI API failed to generate a response');
    }

    if (model.parsingHelperTokens.endToken) {
      //remove the end token from the choice
      const choiceParts = choice.split(model.parsingHelperTokens.endToken);
      if (choiceParts.length > 1) {
        choice = choiceParts[0];
      } else {
        return choice;
      }
      //check if the start token is present in the choice
      if (choice.includes(model.parsingHelperTokens.startToken)) {
        const parts = choice.split(model.parsingHelperTokens.startToken);
        //get the last part of the split
        if (parts.length > 1) {
          // @ts-ignore
          choice = parts.at(-1);
        }
      }
    }
    return choice;
  }

  private formatPrompt(
    model: TogetherAIConfig,
    systemMessage: string,
    userPrompt: string
  ): string {
    let finalPrompt = '';
    const chatPrompt = model.chatTemplate;

    if (chatPrompt) {
      finalPrompt = chatPrompt
        .replace('{system_message}', systemMessage)
        .replace('{user_prompt}', userPrompt);
    } else {
      try {
        const promptFormat =
          this.modelConfigs[model.modelName].config.prompt_format;
        finalPrompt = promptFormat
          .replace('{system_message}', systemMessage)
          .replace('{prompt}', userPrompt);
      } catch (error) {
        console.warn(
          'Chat prompt is not defined for this model. Please define it in the model config. Using default chat prompt'
        );
        finalPrompt = '[INST]{system_message}[/INST]\n{user_prompt}'
          .replace('{system_message}', systemMessage)
          .replace('{user_prompt}', userPrompt);
      }
    }

    if (model.parsingHelperTokens?.startToken) {
      finalPrompt += model.parsingHelperTokens.startToken;
    }

    return finalPrompt;
  }

  private checkApiKey(): void {
    if (!this.apiKey) {
      this.apiKey = process.env.TOGETHER_API_KEY;
      if (!this.apiKey) {
        throw new Error('TogetherAI API key is not set');
      }
    }
  }

  private async fetchModelInfo(modelName: string): Promise<ModelInfo> {
    const info = await fetch('https://api.together.xyz/models/info', {
      headers: {
        authorization: `Bearer ${this.apiKey}`,
      },
    });
    try {
      const modelList = (await info.json()) as ModelInfo[];

      // Get the model configuration by iterating over the modelList and filtering by name
      return modelList.filter(
        (model: ModelInfo) => model.name === modelName
      )[0];
    } catch (error) {
      throw new Error(
        'TogetherAI API failed to fetch model info. Is your API key correct?'
      );
    }
  }
}
