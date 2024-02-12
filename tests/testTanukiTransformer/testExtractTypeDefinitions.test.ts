import { PatchFunctionCompiler } from '../../src/tanukiTransformer';
import ts, {TypeAliasDeclaration} from "typescript";

const minimalTsMock: Partial<typeof ts> = {
    createProgram: jest.fn(),
    // @ts-ignore
    isTypeAliasDeclaration: jest.fn().mockImplementation((node: Node): node is TypeAliasDeclaration => {
         return true;
    }),
    forEachChild: jest.fn(),
};

const mockSourceFiles: ts.SourceFile[] = [
    {
        fileName: 'file1.ts',
        text: 'const a: string = "Hello, world!";',
        getFullText: () => 'const a: string = "Hello, world!";',
    } as unknown as ts.SourceFile, // Cast to satisfy the ts.SourceFile type if necessary.
];

const mockProgram: ts.Program = {
    getSourceFiles: jest.fn().mockReturnValue(mockSourceFiles),
} as unknown as ts.Program; // Cast to satisfy the ts.Program type
describe('extractTypeDefinitions', () => {
    let compiler: PatchFunctionCompiler;

    beforeEach(() => {
        compiler = new PatchFunctionCompiler(mockProgram, minimalTsMock as typeof ts);
    });
    it('extracts type definitions from type alias declarations', () => {
        // Simulate a TypeScript AST node containing type alias declarations
        const typeAliasNode = {
            name: { text: 'TypeName' }, // Mock the name property of the type alias declaration
            type: { getText: () => 'TypeDefinition' }, // Mock the type property of the type alias declaration
        };

        // Call the extractTypeDefinitions method with the simulated node
        compiler.extractTypeDefinitions(typeAliasNode as unknown as ts.Node);

        // Assert that the typeDefinitions property is populated correctly
        // @ts-ignore (public)
        expect(compiler.typeDefinitions).toEqual({ TypeName: 'TypeDefinition' });
    });
});
