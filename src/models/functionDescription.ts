import * as crypto from 'crypto';
import { FunctionType } from './functionType';

class FunctionDescription {
  name: string;
  docstring: string;
  inputTypeDefinition: string;
  outputTypeDefinition: string;
  type: FunctionType = FunctionType.SYMBOLIC;

  constructor(
    name: string,
    docstring: string,
    inputTypeDefinition: string,
    outputTypeDefinition: string,
    type: FunctionType = FunctionType.SYMBOLIC
  ) {
    this.name = name;
    this.docstring = docstring;
    this.inputTypeDefinition = inputTypeDefinition;
    this.outputTypeDefinition = outputTypeDefinition;
    this.type = type;
  }

  hash(purpose: 'general' | 'finetune' = 'general'): string {
    const jsonEncoded = JSON.stringify(this);
    if (purpose === 'general') {
      return crypto.createHash('md5').update(jsonEncoded).digest('hex');
    } else if (purpose === 'finetune') {
      return crypto.createHash('shake256', { outputLength: 8 }).update(jsonEncoded).digest('hex');
    }
    throw new Error('Invalid hashing purpose');
  }
}

export { FunctionDescription };