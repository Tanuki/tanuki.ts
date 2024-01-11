export type Token = string;
export type TokenStream = Token[];

export interface JSONSchema {
  type?: string | string[];
  properties?: { [key: string]: JSONSchema };
  items?: JSONSchema | JSONSchema[];
  enum?: Array<string | number | null>;
  additionalProperties?: boolean | JSONSchema;
  format?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  required?: string[];
  allOf?: JSONSchema[];
  anyOf?: JSONSchema[];
  oneOf?: JSONSchema[];
  not?: JSONSchema;
  $id?: string;
  $ref?: string;
  $schema?: string;
  definitions?: Record<string, JSONSchema>;
  // Add other JSON Schema keywords as needed
  [key: string]: any;
}