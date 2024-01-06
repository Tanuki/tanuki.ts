export type Token = string;
export type TokenStream = Token[];

export interface JSONSchema {
  type?: string;
  properties?: { [key: string]: JSONSchema };
  items?: JSONSchema;
  enum?: Array<string | number>;
  additionalProperties?: boolean | JSONSchema;
  [key: string]: any;
}
