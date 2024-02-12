import { FunctionType } from '../../src/models/functionType';
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
function findClassOrModuleDeclaration(file: ts.SourceFile, name: string): ts.ClassDeclaration | ts.ModuleDeclaration | null {
    let declaration: ts.ClassDeclaration | ts.ModuleDeclaration | null = null;

    const visit = (node: ts.Node) => {
        if (ts.isClassDeclaration(node) && node.name && node.name.text === name) {
            declaration = node;
        } else if (ts.isModuleDeclaration(node) && node.name && ts.isIdentifier(node.name) && node.name.text === name) {
            declaration = node;
        }

        if (!declaration) {
            ts.forEachChild(node, visit);
        }
    };

    visit(file);

    return declaration;
}
describe('extractPatchFunction', () => {
    let compiler: PatchFunctionCompiler;

    beforeEach(() => {
        const mockProgram: ts.Program = {
            getSourceFiles: jest.fn().mockReturnValue(mockSourceFiles),
        } as unknown as ts.Program; // Cast to satisfy the ts.Program type
        compiler = new PatchFunctionCompiler(mockProgram, ts);
    });

    it('extracts symbolic patch function with valid input', () => {
        // Setup: Create a mock node, file, and class/module declaration
        const functionName = 'classifySentiment';

        const text = `
         class MyPatchClass {
            static classifySentiment = patch< "Good" | "Bad", string>()
                \`Classify input objects\`;
         }
        `;
        const file = ts.createSourceFile('in-memory.ts', text, ts.ScriptTarget.Latest);

        const currentClassOrModule = findClassOrModuleDeclaration(file, 'MyPatchClass');

        // @ts-ignore
        const mockNode: ts.Node = (file.statements[0].members as Array<ts.Node>)[0];

        const mockProgram: ts.Program = {
            getSourceFiles: jest.fn().mockReturnValue([file]),
        } as unknown as ts.Program; // Cast to satisfy the ts.Program type
        compiler = new PatchFunctionCompiler(mockProgram, ts);//minimalTsMock as typeof ts);

        // Call the function under test
        const result = compiler.extractPatchFunction(mockNode, functionName, file, currentClassOrModule);

        // Assertions: Verify that the result matches expectations
        const compiledFunctionDescription = {
            name: 'classifySentiment',
            docstring: 'Classify input objects',
            parentName: 'MyPatchClass',
            sourceFile: 'in-memory.ts',
            inputTypeDefinition: 'string',
            outputTypeDefinition: '"Good" | "Bad"',
            type: FunctionType.SYMBOLIC,
            inputTypeSchema: undefined,
            outputTypeSchema: undefined,
        }
        expect(result).toEqual(compiledFunctionDescription)
    });

    it('extracts embeddable patch function with valid input', () => {
        // Setup: Create a mock node, file, and class/module declaration
        const functionName = 'classifySentiment';

        const text = `
         class MyPatchClass {
            static classifySentiment = patch<Embedding<number>, string>()
                \`Classify input objects\`;
         }
        `;
        const file = ts.createSourceFile('in-memory.ts', text, ts.ScriptTarget.Latest);

        const currentClassOrModule = findClassOrModuleDeclaration(file, 'MyPatchClass');

        // @ts-ignore
        const mockNode: ts.Node = (file.statements[0].members as Array<ts.Node>)[0];

        const mockProgram: ts.Program = {
            getSourceFiles: jest.fn().mockReturnValue([file]),
        } as unknown as ts.Program; // Cast to satisfy the ts.Program type
        compiler = new PatchFunctionCompiler(mockProgram, ts);//minimalTsMock as typeof ts);

        // Call the function under test
        const result = compiler.extractPatchFunction(mockNode, functionName, file, currentClassOrModule);

        // Assertions: Verify that the result matches expectations
        const compiledFunctionDescription = {
            name: 'classifySentiment',
            docstring: 'Classify input objects',
            parentName: 'MyPatchClass',
            sourceFile: 'in-memory.ts',
            inputTypeDefinition: 'string',
            outputTypeDefinition: 'Embedding<number>',
            type: FunctionType.EMBEDDABLE,
            inputTypeSchema: undefined,
            outputTypeSchema: undefined,
        }
        expect(result).toEqual(compiledFunctionDescription)
    });

    it('throws an error for reserved class names', () => {
    // Setup: Create a mock node, file, and class/module declaration
    const functionName = 'classifySentiment';

    const text = `
         class Function {
            static classifySentiment = patch< "Good" | "Bad", string>()
                \`Classify input objects\`;
         }
        `;
        const file = ts.createSourceFile('in-memory.ts', text, ts.ScriptTarget.Latest);

        const currentClassOrModule = findClassOrModuleDeclaration(file, functionName);

        // @ts-ignore
        const mockNode: ts.Node = (file.statements[0].members as Array<ts.Node>)[0];

        // @ts-ignore (overriding a readonly property)
        mockNode.parent = file.statements[0];

        const mockProgram: ts.Program = {
            getSourceFiles: jest.fn().mockReturnValue([file]),
        } as unknown as ts.Program; // Cast to satisfy the ts.Program type
        compiler = new PatchFunctionCompiler(mockProgram, ts);

        // Assertions: Expect an error to be thrown
        expect(() => compiler.extractPatchFunction(mockNode, functionName, file, currentClassOrModule))
            .toThrow('The class `Function` cannot have patched functions as members, as this is a reserved word. You could rename the class.');
    });

    it('handles missing docstring declaration', () => {
        // Setup: Create a mock node, file, and class/module declaration
        const functionName = 'classifySentiment';

        const text = `
         class Classify {
            static classifySentiment = patch();
         }
        `;
        const file= ts.createSourceFile('in-memory.ts', text, ts.ScriptTarget.Latest);

        const currentClassOrModule = findClassOrModuleDeclaration(file, functionName);

        // @ts-ignore
        const mockNode: ts.Node = (file.statements[0].members as Array<ts.Node>)[0];

        // @ts-ignore (overriding a readonly property)
        mockNode.parent = file.statements[0];

        const mockProgram: ts.Program = {
            getSourceFiles: jest.fn().mockReturnValue([file]),
        } as unknown as ts.Program; // Cast to satisfy the ts.Program type
        compiler = new PatchFunctionCompiler(mockProgram, ts);

        // Assertions: Expect an error to be thrown
        expect(() => compiler.extractPatchFunction(mockNode, functionName, file, currentClassOrModule))
            .toThrow('Node is not a property declaration with a tagged template expression');
    });




});