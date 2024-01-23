import { OpenAIAPI } from "../../src/languageModels/openAIAPI";
import { OpenAIConfig } from "../../src/languageModels/llmConfigs/openAIConfig";
import { OpenAI } from "openai";
import { PermissionDeniedError } from "openai/error";

jest.mock('openai', () => {
  const mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn()
        }
      },
    fineTuning: {
      jobs: {
        list: jest.fn(),
      }
    },
  };
  return {
    OpenAI: jest.fn(() => mockOpenAI)
  }
});
describe('TestOpenAIAPI', () => {
  let api: OpenAIAPI;

  beforeEach(() => {
    jest.clearAllMocks();
    api = new OpenAIAPI();
  })

  it('test_missing_api_key', () => {
    process.env.OPENAI_API_KEY = '';

    const openAIInstance = new OpenAI();
    // @ts-ignore
    openAIInstance.chat.completions.create.mockImplementation(() => {
      throw new Error("API key is missing");
    });

    expect(async () => {
      await api.generate(new OpenAIConfig({ modelName: "test_model", contextLength: 112 }), "system_message", "prompt")
    }).rejects.toThrowError();
  });

  test('test_invalid_api_key', async () => {
    const openAIInstance = new OpenAI();
    // @ts-ignore
    openAIInstance.chat.completions.create.mockImplementation(() => {
      throw new PermissionDeniedError(403, "invalid_api_key", "API key is missing", {})
    });
    process.env.OPENAI_API_KEY = 'invalid_api_key';
    const api = new OpenAIAPI();

    await expect(api.generate(new OpenAIConfig({ modelName: 'test_model', contextLength: 112 }), 'system_message', 'prompt'))
      .rejects.toThrow('invalid_api_key');
  }, 15000);

  test('test_successful_generation', async () => {
    // Cast the mocked method to Jest Mock type
    const mockResponse = { choices: [{ message: { content: "Generated response" } }] };
    // Here we use the mocked `openai` module
    const openAIInstance = new OpenAI();
    // @ts-ignore
    openAIInstance.chat.completions.create.mockResolvedValue(mockResponse);
    process.env.OPENAI_API_KEY = 'valid_api_key';
    const result = await api.generate(new OpenAIConfig({ modelName: 'test_model', contextLength: 112 }), 'system_message', 'prompt');
    expect(result).toBe("Generated response");
  });

  test('test_list_finetuned', async () => {
    const mockFineTuningJobs = [
      {
        id: "b",
        created_at: 1,
        fine_tuned_model: "bla",
        finished_at: 1,
        error: null,
        hyperparameters: { n_epochs: 1 },
        object: "fine_tuning.job",
        result_files: [],
        status: "succeeded",
        trained_tokens: 1,
        training_file: "bla",
        validation_file: "bla",
        model: "bla",
        organization_id: "b",
      }
    ];

    const openAIInstance = new OpenAI();

    openAIInstance.fineTuning.jobs.list = jest.fn().mockResolvedValue({data: mockFineTuningJobs});

    process.env.OPENAI_API_KEY = 'valid_api_key';
    const api = new OpenAIAPI();

    // Call the method under test
    const result = await api.listFinetuned(1);

    // Check that the length of the result matches the expected value
    expect(result.length).toBe(1);
  });
});
