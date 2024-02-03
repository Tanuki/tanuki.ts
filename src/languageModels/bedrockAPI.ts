import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelCommandInput,
} from '@aws-sdk/client-bedrock-runtime';
import { BaseModelConfig } from './llmConfigs/baseModelConfig'; // Adjust the import based on your project structure

export class BedrockAPI {
  private bedrockRuntime: BedrockRuntimeClient;

  constructor() {
    this.bedrockRuntime = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }

  async sendApiRequest(model: BaseModelConfig, body: any): Promise<any> {
    const params: InvokeModelCommandInput = {
      modelId: model.modelName, // Assuming BaseModelConfig has a modelId property
      contentType: 'application/json',
      accept: 'application/json',
      body: body, //JSON.stringify(body),
    };

    const command = new InvokeModelCommand(params);

    try {
      const response = await this.bedrockRuntime.send(command);
      const responseString = new TextDecoder().decode(response.body);
      return JSON.parse(responseString) as { generation: string };
    } catch (error) {
      throw new Error(
        `Error invoking Bedrock model: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }
}
