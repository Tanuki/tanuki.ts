import {
    OpenAI,
    toFile
} from 'openai';
import { AxiosResponse } from 'axios';
import axios from 'axios';
import * as process from 'process';
import {FinetuneJob} from "../models/finetuneJob";
import {DEFAULT_DISTILLED_MODEL_NAME} from "../constants";
import {Readable} from "stream";
import {FineTuningJob} from "openai/resources/fine-tuning";
import {AnyscaleConfig} from "./llmConfigs/anyscaleConfig";
import EmbeddingAPI from "./embeddingAPI";
import LLMApi from "./LLMApi";
import LLMFinetuneAPI from "./LLMFinetuneAPI";
import {Finetunable, Inferable} from '../APIManager';
import {BaseModelConfig} from "./llmConfigs/baseModelConfig";

const ANYSCALE_URL = "https://api.endpoints.anyscale.com/v1";
const LLM_GENERATION_PARAMETERS = [
    'temperature',
    'top_p',
    'max_new_tokens',
    'frequency_penalty',
    'presence_penalty',
];

class AnyscaleAPI implements Finetunable, Inferable {
    private apiKey: string | undefined = process.env.ANYSCALE_API_KEY;
    private client: OpenAI;

    constructor() {
        if (!this.apiKey) {
            throw new Error("Anyscale API key is not set");
        }
        this.client = new OpenAI({ apiKey: this.apiKey });
    }

    private checkApiKey(): void {
        if (!this.apiKey) {
            throw new Error("Anyscale API key is not set");
        }
    }

    public async generate(
        model: BaseModelConfig,
        systemMessage: string,
        prompt: string,
        kwargs: any = {}
    ): Promise<string> {

        this.checkApiKey();

        const { temperature = 0.1, topP = 1, frequencyPenalty = 0, presencePenalty = 0, maxNewTokens } = kwargs;
        let unsupportedParams = Object.keys(kwargs).filter(key => !LLM_GENERATION_PARAMETERS.includes(key));
        if (unsupportedParams.length > 0) {
            console.warn(`Unused generation parameters sent as input: ${unsupportedParams}. For Anyscale, only the following parameters are supported: ${LLM_GENERATION_PARAMETERS}`);
        }

        let params = {
            model: model.modelName,
            temperature,
            max_tokens: maxNewTokens,
            top_p: topP,
            frequency_penalty: frequencyPenalty,
            presence_penalty: presencePenalty,
            messages: [
                { role: "system", content: systemMessage },
                { role: "user", content: prompt + (model.parsingHelperTokens.startToken || "") }
            ],
        };

        let choice = '';
        let counter = 0;
        while (counter <= 5) {
            try {
                const response: AxiosResponse = await axios.post(`${ANYSCALE_URL}/chat/completions`, params, {
                    headers: {
                        "Authorization": `Bearer ${this.apiKey}`,
                        "Content-Type": "application/json",
                    },
                    timeout: 50000,
                });
                const responseData = response.data;
                choice = responseData.choices[0].message.content.trim();
                if (model.parsingHelperTokens.endToken) {
                    choice = choice.split(model.parsingHelperTokens.endToken)[0];
                    if (model.parsingHelperTokens.startToken && choice.includes(model.parsingHelperTokens.startToken)) {
                        choice = choice.split(model.parsingHelperTokens.startToken)[1];
                    }
                }
                break;
            } catch (error: any) {
                if (error.response && error.response.data && error.response.data.error.code === 'invalid_api_key') {
                    throw new Error(`The supplied Anyscale API key ${this.apiKey} is invalid`);
                }
                if (counter === 5) {
                    throw new Error(`Anyscale API failed to generate a response: ${error}`);
                }
                counter++;
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, counter) * 1000)); // Exponential backoff
            }
        }

        if (!choice) {
            throw new Error("Anyscale API failed to generate a response");
        }

        return choice.trim();
    }

    public async listFinetuned(modelConfig: AnyscaleConfig, limit: number = 100): Promise<FinetuneJob[]> {
        this.checkApiKey();
        try {
            const response = await this.client.fineTuning.jobs.list({ limit });
            const jobs = response.data.map((job: FineTuningJob) => this.createFinetuneJob(job, modelConfig));
            return jobs;
        } catch (error) {
            console.error("Failed to list fine-tuned jobs:", error);
            throw error;
        }
    }

    public async getFinetuned(jobId: string, modelConfig: AnyscaleConfig): Promise<FinetuneJob> {
        this.checkApiKey();
        try {
            const response: FineTuningJob = await this.client.fineTuning.jobs.retrieve(jobId);
            const finetuneJob = this.createFinetuneJob(response, modelConfig);
            return finetuneJob;
        } catch (error) {
            console.error(`Failed to get fine-tuned job ${jobId}:`, error);
            throw error;
        }
    }


    public async finetune(fileBuffer: Buffer, suffix: string, modelConfig: AnyscaleConfig, kwargs: any = {}): Promise<FinetuneJob> {
        this.checkApiKey();

        // Assuming toFile converts a Buffer to a form OpenAI's SDK can accept.
        // This might require adjusting based on how the OpenAI SDK expects files.
        const fileStream = Readable.from(fileBuffer);
        const fileUploadResponse = await this.client.files.create({
            file: await toFile(fileStream),
            purpose: 'fine-tune',
        });

        const trainingFileId = fileUploadResponse.id;
        if (!modelConfig.baseModelForSft) {
            modelConfig.baseModelForSft = DEFAULT_DISTILLED_MODEL_NAME;
        }

        const finetuningResponse: FineTuningJob = await this.client.fineTuning.jobs.create({
            training_file: trainingFileId,
            model: modelConfig.baseModelForSft,
            suffix: suffix,
            // Adjust hyperparameters as necessary.
            hyperparameters: { context_length: 4096, ...kwargs },
        });

        return this.createFinetuneJob(finetuningResponse, modelConfig);
    }

    private createFinetuneJob(response: FineTuningJob, modelConfig: AnyscaleConfig): FinetuneJob {
        // Deep copy of modelConfig might require a utility function or manual copy,
        // depending on its complexity.
        const finetunedModelConfig: AnyscaleConfig = {
            ...modelConfig,
            modelName: response.fine_tuned_model || "Not Available",
        };

        return new FinetuneJob(response.id, response.status, finetunedModelConfig);
    }


    // Placeholder for other methods such as listFinetuned, getFinetuned, finetune, and createFinetuneJob
    // Implement these methods following the structure and logic from the Python code
}

export {AnyscaleAPI};