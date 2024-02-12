import ts from "typescript";
import {PatchFunctionCompiler} from "../../src/tanukiTransformer";

const minimalTsMock: Partial<typeof ts> = {
    createProgram: jest.fn(),
};

const mockSourceFiles: ts.SourceFile[] = [
    {
        fileName: 'file1.ts',
        text: 'const a: string = "Hello, world!";',
        getFullText: () => 'const a: string = "Hello, world!";',
        // Add other properties and methods as required for your tests.
    } as unknown as ts.SourceFile, // Cast to satisfy the ts.SourceFile type if necessary.
];

const mockProgram: ts.Program = {
    getSourceFiles: jest.fn().mockReturnValue(mockSourceFiles),
    // Mock other methods of ts.Program as required for your implementation
} as unknown as ts.Program; // Cast to satisfy the ts.Program type

const transformer = new PatchFunctionCompiler(mockProgram, minimalTsMock as typeof ts);
describe('tokenizeTypeScriptType', () => {
    it('should tokenize a simple type', () => {
        const result = transformer.tokenizeTypeScriptType('string');
        expect(result).toEqual(['string']);

    });

    it('should tokenize an array type', () => {
        const result = transformer.tokenizeTypeScriptType('string[]');
        expect(result).toEqual(['string[]']);
    });

    it('should tokenize a union type', () => {
        const result = transformer.tokenizeTypeScriptType('string | null');
        expect(result).toEqual(['string | null']);
    });

    it('should tokenize a complex type with interfaces', () => {
        const result = transformer.tokenizeTypeScriptType('{ name: string; age: number | null; }');
        expect(result).toEqual(['{', 'name:', 'string', ';', 'age:', 'number | null', ';', '}']);
    });

    it('should ignore empty tokens', () => {
        const result = transformer.tokenizeTypeScriptType(' ');
        expect(result).toEqual([]);
    });

    it('should treat generic types as a single token', () => {
        const result = transformer.tokenizeTypeScriptType('Array<string>');
        expect(result).toEqual(['Array<string>']);
    });

    it('should tokenize generic types with multiple parameters', () => {
        const result = transformer.tokenizeTypeScriptType('Map<string, number>');
        expect(result).toEqual(['Map<string, number>']);
    });

    it('should tokenize generic types with constraints', () => {
        const result = transformer.tokenizeTypeScriptType('<T extends string | number>');
        expect(result).toEqual(['<T extends string | number>']);
    });

    it('should tokenize tuple types', () => {
        const result = transformer.tokenizeTypeScriptType('[string, number]');
        expect(result).toEqual(['[string, number]']);
    });

    it('should tokenize types with optional properties', () => {
        const result = transformer.tokenizeTypeScriptType('{ name?: string; age?: number }');
        expect(result).toEqual(['{', 'name?', ':', 'string', ';', 'age?', ':', 'number', '}']);
    });

    it('should tokenize nested object types', () => {
        const result = transformer.tokenizeTypeScriptType('{ user: { name: string; age: number }; }');
        expect(result).toEqual(['{', 'user:', '{', 'name:', 'string', ';', 'age:', 'number', '}', ';', '}']);
    });
});