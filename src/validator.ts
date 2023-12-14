import { TypeDescription } from './models/typeDescription';

export class Validator {
  checkType(value: any, typeDefinition: string): boolean {
    return false;
  }

  instantiate<T>(type: { new (...args: any[]): T }, ...args: any[]): T {
    return new type(...args);
  }
}
