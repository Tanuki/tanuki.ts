import { FunctionDescription } from "./models/functionDescription";
import { FunctionType } from "./models/functionType";
import PatchFunctionCompiler from "./patchFunctionCompiler";
import fs from "fs";
import path from "path";

interface FunctionDescriptionJSON {
  name: string;
  docstring: string;
  inputTypeDefinition: string;
  outputTypeDefinition: string;
  type?: FunctionType; // Optional if not always present
}

// eslint-disable-next-line @typescript-eslint/ban-types
const alignableSymbolicFunctions: Record<string, Function> = {};
// eslint-disable-next-line @typescript-eslint/ban-types
const alignableEmbeddingFunctions: Record<string, Function> = {};

export class Register {

  static alignableSymbolicFunctions: Record<string, FunctionDescription> = {};
  static alignableEmbeddingFunctions: Record<string, FunctionDescription> = {};

  static loadFunctions() {
    const distDirectory = PatchFunctionCompiler.getDistDirectory();

    // Ensure the dist directory exists
    if (!fs.existsSync(distDirectory)) {
      fs.mkdirSync(distDirectory, { recursive: true });
    }

    // Define the input file path within the dist directory
    const inputPath = path.join(distDirectory, 'output.json');

    if (!fs.existsSync(inputPath)) {
      console.error('JSON file not found:', inputPath);
      return;
    }

    const fileContent = fs.readFileSync(inputPath, 'utf8');
    const jsonContent = JSON.parse(fileContent) as FunctionDescriptionJSON[];
    const patchFunctions: FunctionDescription[] = jsonContent.map(item => {
      return new FunctionDescription(
        item.name,
        item.docstring,
        item.inputTypeDefinition,
        item.outputTypeDefinition,
        item.type ?? FunctionType.SYMBOLIC
      );
    });

    patchFunctions.forEach(pf => {
      // Assuming all functions as SYMBOLIC for this example
      if (pf.type === FunctionType.SYMBOLIC) {
        this.alignableSymbolicFunctions[pf.name] = pf;
      } else if (pf.type === FunctionType.EMBEDDABLE) {
        this.alignableEmbeddingFunctions[pf.name] = pf;
      }
    });
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  static get(funcName: string): [FunctionType, Function] | undefined {
    if (funcName in alignableSymbolicFunctions) {
      return [FunctionType.SYMBOLIC, alignableSymbolicFunctions[funcName]];
    } else if (funcName in alignableEmbeddingFunctions) {
      return [FunctionType.EMBEDDABLE, alignableEmbeddingFunctions[funcName]];
    }
    return undefined;
  }
  static functionNamesToPatch(instance?: any, type?: FunctionType): string[] {
    if (instance) {
      return Object.keys(instance).filter(key => {
        if (type === FunctionType.SYMBOLIC) return key in alignableSymbolicFunctions;
        if (type === FunctionType.EMBEDDABLE) return key in alignableEmbeddingFunctions;
        return key in alignableSymbolicFunctions || key in alignableEmbeddingFunctions;
      });
    } else {
      if (type === FunctionType.SYMBOLIC) return Object.keys(alignableSymbolicFunctions);
      if (type === FunctionType.EMBEDDABLE) return Object.keys(alignableEmbeddingFunctions);
      return [...Object.keys(alignableSymbolicFunctions), ...Object.keys(alignableEmbeddingFunctions)];
    }
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  static functionsToPatch(instance?: any, type?: FunctionType): Record<string, Function> {
    const functionNames = Register.functionNamesToPatch(instance, type);
    return functionNames.reduce((acc, funcName) => {
      if (type === FunctionType.SYMBOLIC || !type) acc[funcName] = alignableSymbolicFunctions[funcName];
      if (type === FunctionType.EMBEDDABLE || !type) acc[funcName] = alignableEmbeddingFunctions[funcName];
      return acc;
      // eslint-disable-next-line @typescript-eslint/ban-types
    }, {} as Record<string, Function>);
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  static addFunction(func: Function, functionDescription: FunctionDescription): void {
    if (functionDescription.type === FunctionType.SYMBOLIC) {
      alignableSymbolicFunctions[func.name] = func;
    } else if (functionDescription.type === FunctionType.EMBEDDABLE) {
      alignableEmbeddingFunctions[func.name] = func;
    }
  }

  static loadFunctionDescriptionFromName(funcName: string, instance?: any): FunctionDescription {
    // eslint-disable-next-line @typescript-eslint/ban-types
    let func: Function;

    if (instance) {
      // We want to get an attribute of the instance here.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      func = instance[funcName];
    } else {
      if (funcName in alignableSymbolicFunctions) {
        func = alignableSymbolicFunctions[funcName];
      } else if (funcName in alignableEmbeddingFunctions) {
        func = alignableEmbeddingFunctions[funcName];
      } else {
        throw new Error(`Function ${funcName} not found`);
      }
    }

    /*const functionDescription: FunctionDescription = {
      name: func.name,
      // ... Other properties must be manually set or derived in some way
    };

    return functionDescription;*/
    throw new Error("Method not implemented.");
  }
  static loadFunctionDescription(functionName: string, docString: string): FunctionDescription {
    // Iterate over alignableSymbolicFunctions
    for (const key in this.alignableSymbolicFunctions) {
      if (this.alignableSymbolicFunctions[key].name === functionName && this.alignableSymbolicFunctions[key].docstring.trim() === docString.trim()) {
        return this.alignableSymbolicFunctions[key];
      }
    }

    // Iterate over alignableEmbeddingFunctions
    for (const key in this.alignableEmbeddingFunctions) {
      if (this.alignableEmbeddingFunctions[key].name === functionName && this.alignableEmbeddingFunctions[key].docstring.trim() === docString.trim()) {
        return this.alignableEmbeddingFunctions[key];
      }
    }

    // If no match is found
    throw new Error(`FunctionDescription with name "${functionName}" and docString "${docString}" not found.`);
  }
    /*const { name, docstring, inputTypeHints, outputTypeHint, type } = funcObject;

    const functionDescription: FunctionDescription = {
      name: name,
      docstring: docstring || '',
      inputTypeHints: inputTypeHints || {},
      outputTypeHint: outputTypeHint || null,
      type: type || FunctionType.SYMBOLIC,
      // other properties like inputClassDefinitions and outputClassDefinition
      // need to be manually set or derived based on your application logic
    };

    return functionDescription;*/


  // Load function description methods would be more complex, as TypeScript doesn't support the same level of reflection as Python
  // You might need a different approach based on your application's requirements
}
