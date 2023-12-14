import * as ts from 'typescript';
import * as path from 'path';
import PatchFunctionCompiler from "./patchFunctionCompiler";

export class Tanuki {
  constructor() {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const configPath = ts.findConfigFile('./', ts.sys.fileExists, 'tsconfig.json');
    if (!configPath) {
      throw new Error("Could not find a valid 'tsconfig.json'.");
    }
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsedConfig = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      path.dirname(configPath),
    );

    // Create a TypeScript program with the parsed configuration
    const program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options);
    const patchFunctionCompiler = new PatchFunctionCompiler(program)
    patchFunctionCompiler.compile();
  }

}