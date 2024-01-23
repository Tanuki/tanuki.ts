import axios from 'axios';
//import { OpenAIConfig } from "../../src/languageModels/llmConfigs/openAIConfig";
import { OpenAIAPI } from "../../src/languageModels/openAIAPI";
import { OpenAIConfig } from "../../src/languageModels/llmConfigs/openAIConfig";
import { OpenAI } from 'openai';
jest.mock('openai', () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn()
        }
      },
      fineTuning: {
        jobs: {
          list: jest.fn(),
          retrieve: jest.fn()
        }
      },
      embeddings: {
        create: jest.fn()
      },
      files: {
        create: jest.fn()
      }
    }))
  };
});
describe('TestOpenAIAPI', () => {
  let api: OpenAIAPI;

  beforeEach(() => {
    jest.clearAllMocks();
    api = new OpenAIAPI();
    // @ts-ignore
    /*OpenAI.prototype.chat = {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Generated response' } }],
        }),
        _client: new OpenAI(),
      },
    };*/
  });

  it('test_missing_api_key', () => {
    process.env.OPENAI_API_KEY = '';

    expect(async () => {
      await api.generate(new OpenAIConfig({ modelName: "test_model", contextLength: 112 }), "system_message", "prompt")
    }).rejects.toThrowError();
  });

  test('test_invalid_api_key', async () => {
    /*OpenAI.prototype.chat.completions.create.mockImplementation(() => {
      return Promise.reject(new Error('invalid_api_key'));
    });*/

    process.env.OPENAI_API_KEY = 'invalid_api_key';
    const api = new OpenAIAPI();

    await expect(api.generate(new OpenAIConfig({ modelName: 'test_model', contextLength: 112 }), 'system_message', 'prompt'))
      .rejects.toThrow('invalid_api_key');
  });

});
