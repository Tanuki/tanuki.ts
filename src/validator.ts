import ts from 'typescript';
import { TypeDescription } from './models/typeDescription';

interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  // Add other JSON Schema properties as needed, like 'required', 'enum', 'oneOf', etc.
}

export class Validator {
  checkType(value: any, typeDefinition: string): boolean {
    // Step 1: Parse the type definition
    //const parsedType: JsonSchema = this.parseTypeDefinition(typeDefinition);

    // Step 2: Validate the value against the parsed type
    return false//validateValueAgainstType(value, parsedType);
  }

  instantiate<T>(type: { new (...args: any[]): T }, ...args: any[]): T {
    return new type(...args);
  }
}
