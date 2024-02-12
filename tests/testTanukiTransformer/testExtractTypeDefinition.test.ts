import { PatchFunctionCompiler } from '../../src/tanukiTransformer';
import ts from "typescript";

const fileText = 'const a: string = "Hello, world!";';
const mockSourceFiles: ts.SourceFile[] = [
    {
        fileName: 'file1.ts',
        text: fileText,
        getFullText: () => fileText,
    } as unknown as ts.SourceFile,
];

const mockProgram: ts.Program = {
    getSourceFiles: jest.fn().mockReturnValue(mockSourceFiles),
} as unknown as ts.Program; // Cast to satisfy the ts.Program type
describe('extractTypeDefinition', () => {
    let compiler: PatchFunctionCompiler;

    beforeEach(() => {
        compiler = new PatchFunctionCompiler(mockProgram, ts);
    });

    it('returns primitive types as is', () => {
        const primitiveTypes = ['number', 'string', 'boolean', 'null'];
        primitiveTypes.forEach(type => {
            const typeDefinition: string = compiler.extractTypeDefinition(type, null, mockSourceFiles[0]);
            expect(typeDefinition).toBe(type);
        });
    });

    it('returns an array type definition', () => {
        const typeDefinition: string = compiler.extractTypeDefinition('string[]', null, mockSourceFiles[0]);
        expect(typeDefinition).toBe('array');
    });

});
