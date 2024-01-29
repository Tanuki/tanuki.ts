export class BaseModelConfig {
  modelName: string;
  provider: string;
  contextLength: number;
  chatTemplate?: string;
  systemMessage: string = "You are a skillful and accurate language model, who applies a described function on input data. Make sure the function is applied accurately and correctly and the outputs follow the output type hints and are valid outputs given the output types.";
  instructions: string = "You are given below a function description and input data. The function description of what the function must carry out can be found in the Function section, with input and output type hints. The input data can be found in Input section. Using the function description, apply the function to the Input and return a valid output type, that is acceptable by the output_class_definition and output_class_hint. Return None if you can't apply the function to the input or if the output is optional and the correct output is None.\\nINCREDIBLY IMPORTANT: Only output a JSON-compatible string in the correct response format.";
  repairInstruction: string = "Below are an outputs of a function applied to inputs, which failed type validation. The input to the function is brought out in the INPUT section and function description is brought out in the FUNCTION DESCRIPTION section. Your task is to apply the function to the input and return a correct output in the right type. The FAILED EXAMPLES section will show previous outputs of this function applied to the data, which failed type validation and hence are wrong outputs. Using the input and function description output the accurate output following the output_class_definition and output_type_hint attributes of the function description, which define the output type. Make sure the output is an accurate function output and in the correct type. Return None if you can't apply the function to the input or if the output is optional and the correct output is None.";
  systemMessageTokenCount: number = -1;
  instructionTokenCount: number = -1;
  parsingHelperTokens: {
    startToken: string;
    endToken: string;
  };

  constructor(config: {
    modelName: string,
    instructions?: string,
    provider: string,
    contextLength: number,
    chatTemplate?: string,
    parsingHelperTokens?: {
      startToken: string;
      endToken: string;
    }
  }) {
    this.modelName = config.modelName;
    this.provider = config.provider;
    this.contextLength = config.contextLength;
    this.chatTemplate = config.chatTemplate;
    this.parsingHelperTokens = config.parsingHelperTokens || {startToken: "", endToken: ""};
    this.instructions = config.instructions || this.instructions;
  }

  // Additional methods can be added here
}