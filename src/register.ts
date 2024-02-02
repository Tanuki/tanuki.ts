import { FunctionDescription } from "./models/functionDescription";
import { FunctionType } from "./models/functionType";
//import { PatchFunctionCompiler } from "./tanukiTransformer";//"./patchFunctionCompiler";
import fs from "fs";
import path from "path";
import { JSONSchema } from "./models/jsonSchema";
import { PatchFunctionCompiler } from "./tanukiTransformer";
import { REGISTERED_FUNCTIONS_FILENAME } from "./constants";

interface FunctionDescriptionJSON {
  name: string;
  docstring: string;
  parentName?: string;
  sourceFile?: string;
  inputTypeDefinition: string;
  outputTypeDefinition: string;
  inputTypeSchema: JSONSchema;
  outputTypeSchema: JSONSchema;
  type?: FunctionType; // Optional if not always present
}

// eslint-disable-next-line @typescript-eslint/ban-types
const alignableSymbolicFunctions: Record<string, Function> = {};
// eslint-disable-next-line @typescript-eslint/ban-types
const alignableEmbeddingFunctions: Record<string, Function> = {};

export class Register {

  static alignableSymbolicFunctions: Record<string, Record<string, FunctionDescription>> = {};
  static alignableEmbeddingFunctions: Record<string, Record<string, FunctionDescription>> = {};

  static loadFunctions() {
    const distDirectory = PatchFunctionCompiler.getDistDirectory();

    // Ensure the dist directory exists
    if (!fs.existsSync(distDirectory)) {
      fs.mkdirSync(distDirectory, { recursive: true });
    }

    // Define the input file path within the dist directory
    const inputPath = path.join(distDirectory, REGISTERED_FUNCTIONS_FILENAME);
    let patchFunctions = []
    if (!fs.existsSync(inputPath)) {
      throw new Error('JSON file does not exist.');
    }

    const fileContents = fs.readFileSync(inputPath, 'utf8');
    const lines = fileContents.split(/\r?\n/);

    for (const line of lines) {
      if (line) {
        try {
          const obj = JSON.parse(line) as FunctionDescriptionJSON;
          patchFunctions.push(obj);
        } catch (e) {
          console.error(`Error parsing line: ${e}`);
        }
      }
    }

    if (!fs.existsSync(inputPath)) {
      console.error('JSON file not found:', inputPath);
      return;
    }

    //const fileContent = fs.readFileSync(inputPath, 'utf8');
    //const jsonContent = JSON.parse(fileContent) as FunctionDescriptionJSON[];
    /*const patchFunctions: FunctionDescription[] = jsonContent.map(item => {
      return new FunctionDescription(
        item.name,
        item.docstring,
        undefined,
        undefined,
        item.inputTypeSchema,
        item.outputTypeSchema,
        item.type ?? FunctionType.SYMBOLIC
      );
    });*/

    patchFunctions.forEach(pfj => {
      const pf = new FunctionDescription(
        pfj.name,
        pfj.docstring,
        pfj.parentName,
        pfj.sourceFile,
        undefined,
        undefined,
        pfj.inputTypeSchema,
        pfj.outputTypeSchema,
        pfj.type ?? FunctionType.SYMBOLIC
      );
      if (pf.type === FunctionType.SYMBOLIC) {
        // Ensure the parentName key exists in the alignableSymbolicFunctions object
        if (this.alignableSymbolicFunctions[pf.parentName || ""] == undefined) {
          this.alignableSymbolicFunctions[pf.parentName || ""] = {};
        }
        this.alignableSymbolicFunctions[pf.parentName || ""][pf.name] = pf;
      } else if (pf.type === FunctionType.EMBEDDABLE) {
        if (this.alignableEmbeddingFunctions[pf.parentName || ""] == undefined) {
          this.alignableEmbeddingFunctions[pf.parentName || ""] = {};
        }
        this.alignableEmbeddingFunctions[pf.parentName || ""][pf.name] = pf;
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
  /*
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

   */

  // eslint-disable-next-line @typescript-eslint/ban-types
  /*static functionsToPatch(instance?: any, type?: FunctionType): Record<string, Function> {
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
*/
 /* static loadFunctionDescriptionFromName(funcName: string, instance?: any): FunctionDescription {
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

    return functionDescription;
    throw new Error("Method not implemented.");
  }*/
  // @ts-ignore
  static getNamedFunctions(classContext, docstring: string): FunctionDescription {
    const className = classContext.name;

    const filterFunctions = (functions: Record<string, Record<string, FunctionDescription>>) => {
      // Check if the key exists in the object and is not undefined/null
      const classFunctions = functions[className || ""] || {};
      const values = Object.values(classFunctions);

      return values
          .filter(funcDesc => funcDesc.parentName === classContext.name)
          .filter(funcDesc => docstring === "" || funcDesc.docstring === docstring)
          .map(funcDesc => funcDesc);
    };


    // Apply the filter to both symbolic and embedding functions
    const symbolicFunctionNames = filterFunctions(this.alignableSymbolicFunctions);
    const embeddingFunctionNames = filterFunctions(this.alignableEmbeddingFunctions);
    const allFunctions = [...symbolicFunctionNames, ...embeddingFunctionNames];

    // If more than one function is found, throw an error
    if (allFunctions.length > 1) {
      throw new Error(`Multiple functions in class "${className}" with instruction "${docstring}" found.`);
    }
    // If no function is found, throw an error
    if (allFunctions.length === 0) {
      if (className === undefined && classContext.name === undefined) {
        throw new Error(`Function not resolved. Ensure your Tanuki functions are static class members. Ref:${docstring} not found.`);
      }
      if (classContext.sourceFile === undefined) {
        throw new Error(`Function with name "${className}" and docstring "${docstring}" not found in class "${classContext.name}". Ensure you build your functions with the Tanuki compiler. Ref: "${docstring}"`);
      }
      throw new Error(`Function with name "${className}" and docstring "${docstring}" not found in class "${classContext.name}". Check source file: "${classContext.sourceFile}"`);
    }
    return allFunctions[0]

    // Filter by the members of the classContext
    // const memberFunctionNames = allFunctionNames.filter(name =>
    //     typeof classContext[name] === 'function'
    // );
    // const symbolicFunctionNames = Object.keys(this.alignableSymbolicFunctions)
    //     .filter(key => key.startsWith(classPrefix))
    //     .map(key => key.slice(classPrefix.length)); // Remove the prefix
    //
    // const embeddingFunctionNames = Object.keys(this.alignableEmbeddingFunctions)
    //     .filter(key => key.startsWith(classPrefix))
    //     .map(key => key.slice(classPrefix.length)); // Remove the prefix
    //
    // return [...symbolicFunctionNames, ...embeddingFunctionNames];
  }
  /*static loadFunctionDescription(parentName: string, functionName: string, docString: string): FunctionDescription {
    // Iterate over alignableSymbolicFunctions
    for (const key in this.alignableSymbolicFunctions) {
      if (this.alignableSymbolicFunctions[parentName][key].name === functionName && this.alignableSymbolicFunctions[parentName][key].docstring.trim() === docString.trim()) {
        return this.alignableSymbolicFunctions[parentName][key];
      }
    }

    // Iterate over alignableEmbeddingFunctions
    for (const key in this.alignableEmbeddingFunctions) {
      if (this.alignableEmbeddingFunctions[parentName][key].name === functionName && this.alignableEmbeddingFunctions[parentName][key].docstring.trim() === docString.trim()) {
        return this.alignableEmbeddingFunctions[parentName][key];
      }
    }
    // If no match is found
    throw new Error(`FunctionDescription with name "${functionName}" and docString "${docString}" not found.`);
  }*/
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
