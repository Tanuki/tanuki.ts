//import ts from "typescript";
import * as fs from 'fs';
import * as ts from 'typescript';
import {
  CompiledFunctionDescription,
  PatchFunctionCompiler,
} from '../../src/tanukiTransformer';

import { REGISTERED_FUNCTIONS_FILENAME } from '../../src/tanukiTransformer';

// Mock fs and path modules
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  appendFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}));
jest.mock('path', () => ({
  join: (...args: any[]) => args.join('/'), // Simplify for testing
}));
describe('writeToJSON', () => {
  let compiler: PatchFunctionCompiler;

  const text = `
         class MyPatchClass {
            static classifySentiment = patch< "Good" | "Bad", string>()
                \`Classify input objects\`;
         }
        `;
  const file: ts.SourceFile = ts.createSourceFile(
    'in-memory.ts',
    text,
    ts.ScriptTarget.Latest
  );

  it('writes patch functions to JSON file', () => {
    const mockProgram: ts.Program = {
      getSourceFiles: jest.fn().mockReturnValue([file]),
    } as unknown as ts.Program; // Cast to satisfy the ts.Program type
    compiler = new PatchFunctionCompiler(mockProgram, ts); //minimalTsMock as typeof ts);

    // Mock data
    const patchFunctions = [
      new CompiledFunctionDescription(
        'classifySentiment',
        'This is a docstring',
        'MyPatchClass',
        'in-memory.ts',
        'Classify input objects',
        'Good | Bad',
        undefined,
        undefined
      ),
    ];

    // Mock implementation details
    const distDirectory = '/mockDist';
    PatchFunctionCompiler.getDistDirectory = jest
      .fn()
      .mockReturnValue(distDirectory);

    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    fs.existsSync.mockReturnValue(true); // Assume directory exists

    // Call the method
    compiler.writeToJSON(patchFunctions);

    // Assertions
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(fs.existsSync).toHaveBeenCalledWith(distDirectory);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(fs.mkdirSync).not.toHaveBeenCalled(); // Directory already exists
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(fs.appendFileSync).toHaveBeenCalledTimes(patchFunctions.length);
    patchFunctions.forEach(pf => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        expect.stringContaining(REGISTERED_FUNCTIONS_FILENAME),
        JSON.stringify(pf) + '\n',
        'utf8'
      );
    });
  });
});
