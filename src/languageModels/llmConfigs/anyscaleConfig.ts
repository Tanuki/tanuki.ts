import {BaseModelConfig} from "./baseModelConfig";
import {ANYSCALE_PROVIDER} from "../../constants";

class AnyscaleConfig extends BaseModelConfig {
    baseModelForSft: string;
    constructor(config: {
        modelName: string;
        contextLength: number;
        instructions?: string;
        provider?: string;
        parsingHelperTokens?: { startToken: string; endToken: string };
        baseModelForSft?: string;
    }) {
        super({
            modelName: config.modelName,
            instructions: config.instructions,
            parsingHelperTokens: config.parsingHelperTokens,
            provider: ANYSCALE_PROVIDER,
            contextLength: config.contextLength,
            chatTemplate: AnyscaleConfig.prototype.chatTemplate,
        });
        this.baseModelForSft = config.baseModelForSft || config.modelName;
    }
}

export {AnyscaleConfig};