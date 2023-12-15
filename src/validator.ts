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
    const parsedType: JsonSchema = this.convertTypeStringToJsonSchema(typeDefinition);

    // Step 2: Validate the value against the parsed type
    return false//validateValueAgainstType(value, parsedType);
  }


  convertTypeStringToJsonSchema(typeString: string): JsonSchema {
    const schema: JsonSchema = {};

    // Example of parsing an object type
    if (typeString.startsWith('{') && typeString.endsWith('}')) {
      schema.type = 'object';
      schema.properties = {};

      const propertiesString = typeString.slice(1, -1); // Remove the curly braces
      const propertiesArray = propertiesString.split(';');
      propertiesArray.forEach(propString => {
        const [key, valueTypeString] = propString.trim().split(':').map(s => s.trim());
        if (key && valueTypeString) {
          schema.properties![key] = this.convertTypeStringToJsonSchema(valueTypeString);
        }
      });

    } else {
      if (typeString.startsWith("{ ")) {
        typeString = typeString.slice(2);
      }
      // Handle primitive types
      switch (typeString) {
        case 'string':
          schema.type = 'string';
          break;
        case 'number':
          schema.type = 'number';
          break;
        case 'integer':
          schema.type = 'integer';
          break;
        case 'boolean':
          schema.type = 'boolean';
          break;
        case 'null':
          schema.type = 'null';
          break;
        // Add more cases here for other types you need to support
      }// ... handle other types ...
    }

    return schema;
  }

  instantiate<T>(type: { new (...args: any[]): T }, ...args: any[]): T {
    return new type(...args);
  }
}
