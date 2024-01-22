import axios from 'axios';
import { OpenAIConfig } from "../../src/languageModels/llmConfigs/openAIConfig";
import { OpenAIAPI } from "../../src/languageModels/openAIAPI";

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TestOpenAIAPI', () => {
  it('test_missing_api_key', () => {
    process.env.OPENAI_API_KEY = '';
    const api = new OpenAIAPI();

    expect(() => api.generate(new OpenAIConfig({ modelName: "test_model", contextLength: 112 }), "system_message", "prompt")).toThrowError();
  });

  it('test_invalid_api_key', async () => {
    process.env.OPENAI_API_KEY = 'invalid_key';
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        error: { code: 'invalid_api_key' }
      }
    });

    const api = new OpenAIAPI();
    await expect(api.generate(new OpenAIConfig({ modelName: "test_model", contextLength: 112 }), "system_message", "prompt")).rejects.toThrow("invalid");
  });

  it('test_successful_generation', async () => {
    process.env.OPENAI_API_KEY = 'valid_key';
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        choices: [{ message: { content: "Generated response" } }]
      }
    });

    const api = new OpenAIAPI();
    const result = await api.generate(new OpenAIConfig({ modelName: "test_model", contextLength: 112 }), "system_message", "prompt");
    expect(result).toEqual("Generated response");
  });

  it('test_list_finetuned', async () => {
    process.env.OPENAI_API_KEY = 'valid_key';
    // Assuming OpenAI_API.list_finetuned uses axios internally
    mockedAxios.get.mockResolvedValueOnce({
      data: [
        // Mock data similar to your Python mock
      ]
    });

    const api = new OpenAIAPI();
    const result = await api.listFinetuned(2);
    expect(result.length).toEqual(2);
  });
});
