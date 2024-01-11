import Ajv, { JSONSchemaType } from "ajv";
import addFormats from 'ajv-formats';
import { JSONSchema } from "./models/jsonSchema";

export class Validator {

  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv();
    addFormats(this.ajv);
  }

  checkType<T>(value: T, typeDefinition: JSONSchema): boolean {
    // Validate the value against the JSON Schema
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
    const validate = this.ajv.compile(typeDefinition);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const isValid = validate(value) as boolean;
    return isValid;
  }

  instantiate<T>(type: { new (...args: any[]): T }, ...args: any[]): T {
    return new type(...args);
  }
}
