import * as crypto from 'crypto';
import { FunctionType } from './functionType';
import { JSONSchema } from './jsonSchema';

class FunctionDescription {
  name: string;
  docstring: string;
  parentName?: string;
  sourceFile?: string;
  inputTypeDefinition?: string
  inputTypeSchema?: JSONSchema;
  outputTypeDefinition?: string;
  outputTypeSchema?: JSONSchema;
  type: FunctionType = FunctionType.SYMBOLIC;

  constructor(
    name: string,
    docstring: string,
    parentName?: string,
    sourceFile?: string,
    inputTypeDefinition?: string,
    outputTypeDefinition?: string,
    inputTypeSchema?: JSONSchema,
    outputTypeSchema?: JSONSchema,
    type: FunctionType = FunctionType.SYMBOLIC
  ) {
    this.name = name;
    this.docstring = docstring;
    if (parentName != null) {
      this.parentName = parentName;
    }
    if (sourceFile != null) {
      this.sourceFile = sourceFile;
    }
    if (inputTypeDefinition != null) {
      this.inputTypeDefinition = inputTypeDefinition;
    }
    if (outputTypeDefinition != null) {
      this.outputTypeDefinition = outputTypeDefinition;
    }
    if (inputTypeSchema != null) {
      this.inputTypeSchema = inputTypeSchema;
    }
    if (outputTypeSchema != null) {
      this.outputTypeSchema = outputTypeSchema;
    }
    //this.inputTypeSchema = inputTypeSchema;
    //this.outputTypeSchema = outputTypeSchema;
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