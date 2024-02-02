#!/usr/bin/env node

import ts from "typescript"
import fs from "fs"
import path from "path"
import {glob} from "glob"
import tanukiTransformer, {PatchFunctionCompiler} from "./lib/src/tanukiTransformer.js";

function getTsConfig() {
    const configFile = ts.findConfigFile('./', ts.sys.fileExists, 'tsconfig.json');
    if (!configFile) {
        throw new Error('Could not find a valid "tsconfig.json".');
    }

    const configFileContents = ts.readConfigFile(configFile, ts.sys.readFile);
    return ts.parseJsonConfigFileContent(configFileContents.config, ts.sys, path.dirname(configFile));
}

function applyTransformer(transformerFactory, fileNames, compilerOptions, tsInstance) {
    const program = ts.createProgram(fileNames, compilerOptions);
    // Create the compiler instance and clear the file once here
    const compiler = new PatchFunctionCompiler(program, tsInstance);
    compiler.clearFile();
    fileNames.forEach(fileName => {
        const sourceFile = program.getSourceFile(fileName);
        const transformed = ts.transform(
            sourceFile,
            [transformerFactory(program, tsInstance, compilerOptions, compiler)])
        const printer = ts.createPrinter();
        const result = printer.printFile(transformed.transformed[0]);

        fs.writeFileSync(fileName, result);
    });
}

function tanukiTransformerFactory(program, tsInstance, compilerOptions, compiler) {
    return tanukiTransformer(program, {}, { ts: tsInstance, compiler });
}
console.log(`Current directory: ${process.cwd()}`);
// Using glob.sync to list TypeScript files synchronously
const files = glob.sync(["**/*.ts", "**/*.tsx"], { ignore: ["node_modules/**", "**/*.d.ts"] });

const tsConfig = getTsConfig();

// Apply the transformer
const tsInstance = ts;
applyTransformer(tanukiTransformerFactory, files, tsConfig.options, tsInstance);
