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

describe('findAndResolveType', () => {
    let compiler: PatchFunctionCompiler;

    beforeEach(() => {
        const mockProgram: ts.Program = {
            getSourceFiles: jest.fn().mockReturnValue(mockSourceFiles),
        } as unknown as ts.Program; // Cast to satisfy the ts.Program type
        compiler = new PatchFunctionCompiler(mockProgram, ts);//minimalTsMock as typeof ts);
    });

    it('resolves a type', () => {
        const text = 'type TypeDefinition = string;\ntype TypeName = TypeDefinition;';
        const source = ts.createSourceFile('in-memory.ts', text, ts.ScriptTarget.Latest);
        const typeDefinition: string | undefined = compiler.findAndResolveType('TypeName', source);
        expect(typeDefinition).toBe('string');
    });

    it('resolves an interface', () => {
        const text = `
        interface MyInterface {
            property1: string;
            property2: number;
        }
        type TypeName = MyInterface;
    `;
        const source = ts.createSourceFile('in-memory.ts', text, ts.ScriptTarget.Latest);
        const typeDefinition: string | undefined = compiler.findAndResolveType('TypeName', source);
        expect(typeDefinition).toBe('{ property1: string; property2: number }'); // Or the expected resolved string representation
    });

    it('resolves an enum', () => {
        const text = `
        enum MyEnum {
            First,
            Second,
        }
        type TypeName = MyEnum;
    `;
        const source = ts.createSourceFile('in-memory.ts', text, ts.ScriptTarget.Latest);
        const typeDefinition: string | undefined = compiler.findAndResolveType('TypeName', source);
        expect(typeDefinition).toBe('MyEnum');
    });

    it('resolves a class', () => {
        const text = `
        class MyClass {
            property1: string;
            property2: number;
        }
        type TypeName = MyClass;
    `;
        const source = ts.createSourceFile('in-memory.ts', text, ts.ScriptTarget.Latest);
        const typeDefinition: string | undefined = compiler.findAndResolveType('TypeName', source);
        expect(typeDefinition).toBe('{ property1: string; property2: number }');
    });

    it('resolves a union type', () => {
        const text = 'type TypeName = string | number;';
        const source = ts.createSourceFile('in-memory.ts', text, ts.ScriptTarget.Latest);
        const typeDefinition: string | undefined = compiler.findAndResolveType('TypeName', source);
        expect(typeDefinition).toBe('string | number');
    });

    it('resolves an intersection type', () => {
        const text = `
        interface Interface1 {
            property1: string;
        }
        interface Interface2 {
            property2: number;
        }
        type TypeName = Interface1 & Interface2;
    `;
        const source = ts.createSourceFile('in-memory.ts', text, ts.ScriptTarget.Latest);
        const typeDefinition: string | undefined = compiler.findAndResolveType('TypeName', source);
        // Adjust the expected result based on how your method renders intersection types
        expect(typeDefinition).toBe('{ property1: string } & { property2: number }');
    });

    it('resolves a nested interface', () => {
        const text = `
        interface NestedInterface {
            nestedProperty: {
                subProperty: string;
            };
        }
        type TypeName = NestedInterface;
    `;
        const source = ts.createSourceFile('in-memory.ts', text, ts.ScriptTarget.Latest);
        const typeDefinition: string | undefined = compiler.findAndResolveType('TypeName', source);
        // Expect a detailed representation of the nested interface, decomposed into its primitive types
        expect(typeDefinition).toBe('{ nestedProperty: { subProperty: string } }');
    });

    /*
    // TODO: add support for generics
    it('resolves generics with primitive type parameters', () => {
        const text = `
    type GenericType<T> = T[];
    type TypeName = GenericType<string>;
`;
        const source = ts.createSourceFile('in-memory.ts', text, ts.ScriptTarget.Latest);
        const typeDefinition: string | undefined = compiler.findAndResolveType('TypeName', source);
        expect(typeDefinition).toBe('string[]');
    });
    */
    it('resolves a type alias referencing another complex type', () => {
        const text = `
        type ComplexType = {
            a: number;
            b: string;
            c: boolean[];
        };
        type TypeName = ComplexType;
    `;
        const source = ts.createSourceFile('in-memory.ts', text, ts.ScriptTarget.Latest);
        const typeDefinition: string | undefined = compiler.findAndResolveType('TypeName', source);
        expect(typeDefinition).toBe('{ a: number; b: string; c: boolean[] }');
    });

    it('resolves an interface with method signatures', () => {
        const text = `
        interface InterfaceWithMethods {
            method1(param1: string): number;
            method2(param2: number, param3: boolean): void;
        }
        type TypeName = InterfaceWithMethods;
    `;
        const source = ts.createSourceFile('in-memory.ts', text, ts.ScriptTarget.Latest);
        const typeDefinition: string | undefined = compiler.findAndResolveType('TypeName', source);
        // Expect representation to NOT include method signatures
        expect(typeDefinition).toBe('{}');
    });

    it('resolves a type alias with union and intersection types', () => {
        const text = `
        type BasicTypes = string | number;
        interface InterfaceA { a: string; }
        interface InterfaceB { b: number; }
        type ComplexUnion = BasicTypes | InterfaceA;
        type ComplexIntersection = InterfaceA & InterfaceB;
        type TypeNameUnion = ComplexUnion;
        type TypeNameIntersection = ComplexIntersection;
    `;
        const source = ts.createSourceFile('in-memory.ts', text, ts.ScriptTarget.Latest);
        const typeDefinitionUnion: string | undefined = compiler.findAndResolveType('TypeNameUnion', source);
        const typeDefinitionIntersection: string | undefined = compiler.findAndResolveType('TypeNameIntersection', source);
        expect(typeDefinitionUnion).toBe('string | number | { a: string }');
        expect(typeDefinitionIntersection).toBe('{ a: string } & { b: number }');
    });

    it('resolves types with optional properties', () => {
        const text = `
        interface OptionalProps {
            requiredProp: number;
            optionalProp?: string;
        }
        type TypeName = OptionalProps;
    `;
        const source = ts.createSourceFile('in-memory.ts', text, ts.ScriptTarget.Latest);
        const typeDefinition: string | undefined = compiler.findAndResolveType('TypeName', source);
        expect(typeDefinition).toBe('{ requiredProp: number; optionalProp?: string }');
    });

    it ('resolves optional types', () => {
        const text = `
                interface OptionalProps {
                    requiredProp: number;
                    optionalProp: string | undefined;
                }
                type TypeName = OptionalProps;
            `;
        const source = ts.createSourceFile('in-memory.ts', text, ts.ScriptTarget.Latest);
        const typeDefinition: string | undefined = compiler.findAndResolveType('TypeName', source);
        expect(typeDefinition).toBe('{ requiredProp: number; optionalProp: string | undefined }');
    });

    it('resolves types with readonly properties', () => {
        const text = `
        interface ReadonlyInterface {
            readonly prop1: string;
            prop2: number;
        }
        type TypeName = ReadonlyInterface;
    `;
        const source = ts.createSourceFile('in-memory.ts', text, ts.ScriptTarget.Latest);
        const typeDefinition: string | undefined = compiler.findAndResolveType('TypeName', source);
        expect(typeDefinition).toBe('{ prop1: string; prop2: number }');
    });

    it('resolve optional types in a union', () => {
        const text = `
                interface Interface1 {
                    property1: string;
                }
                interface Interface2 {
                    property2?: number;
                }
                type TypeName = Interface1 & Interface2;
           `;
        const source = ts.createSourceFile('in-memory.ts', text, ts.ScriptTarget.Latest);
        const typeDefinition: string | undefined = compiler.findAndResolveType('TypeName', source);
        expect(typeDefinition).toBe('{ property1: string } & { property2?: number }');
    });
    /*
    //TODO: add support for indexed access types
    it('resolves indexed access types', () => {
        const text = `
    interface Person { name: string; age: number; }
    type NameType = Person['name'];
    type AgeType = Person['age'];
`;
        const source = ts.createSourceFile('in-memory.ts', text, ts.ScriptTarget.Latest);
        const nameTypeDefinition: string | undefined = compiler.findAndResolveType('NameType', source);
        const ageTypeDefinition: string | undefined = compiler.findAndResolveType('AgeType', source);
        expect(nameTypeDefinition).toBe('string');
        expect(ageTypeDefinition).toBe('number');
    });
    */


it('resolves Partial types', () => {
    const text = `
        interface MyInterface {
            prop1: string;
            prop2: number;
        }
        type TypeName = Partial<MyInterface>;
    `;
    const source = ts.createSourceFile('in-memory.ts', text, ts.ScriptTarget.Latest);
    const typeDefinition: string | undefined = compiler.findAndResolveType('TypeName', source);
    expect(typeDefinition).toBe('{ prop1?: string; prop2?: number }');
});

it('resolves Readonly types', () => {
    const text = `
        interface MyInterface {
            prop1: string;
            prop2: number;
        }
        type TypeName = Readonly<MyInterface>;
    `;
    const source = ts.createSourceFile('in-memory.ts', text, ts.ScriptTarget.Latest);
    const typeDefinition: string | undefined = compiler.findAndResolveType('TypeName', source);
    expect(typeDefinition).toBe('{ prop1: string; prop2: number }');
});

it('resolves a simple mapped type', () => {

    const text = `
        type MyMappedType<T> = {
            [P in keyof T]: T[P];
        };
        interface MyInterface {
            prop1: string;
            prop2: number;
        }
        type TypeName = MyMappedType<MyInterface>;
    `;
    const source = ts.createSourceFile('in-memory.ts', text, ts.ScriptTarget.Latest);
    const typeDefinition: string | undefined = compiler.findAndResolveType('TypeName', source);
    expect(typeDefinition).toBe('{ prop1: string; prop2: number }');
});

it('resolves a basic conditional type', () => {
    const text = `
            type ConditionalType<T> = T extends string ? 'stringType' : 'otherType';
            type StringTypeName = ConditionalType<string>;
            type NumberTypeName = ConditionalType<number>;
        `;
    const source = ts.createSourceFile('in-memory.ts', text, ts.ScriptTarget.Latest);
    const stringTypeDefinition: string | undefined = compiler.findAndResolveType('StringTypeName', source);
    const numberTypeDefinition: string | undefined = compiler.findAndResolveType('NumberTypeName', source);
    expect(stringTypeDefinition).toBe("'stringType'");
    expect(numberTypeDefinition).toBe("'otherType'");
});

it('resolves a simple tuple type', () => {
    const text = `
        type MyTuple = [string, number];
        type TypeName = MyTuple;
        `;
    const source = ts.createSourceFile('in-memory.ts', text, ts.ScriptTarget.Latest);
    const typeDefinition: string | undefined = compiler.findAndResolveType('TypeName', source);
    expect(typeDefinition).toBe('[string, number]');
});

it('resolves a tuple type with optional elements', () => {
    const text = `
        type MyTuple = [string, number?];
        type TypeName = MyTuple;
        `;
    const source = ts.createSourceFile('in-memory.ts', text, ts.ScriptTarget.Latest);
    const typeDefinition: string | undefined = compiler.findAndResolveType('MyTuple', source);
    expect(typeDefinition).toBe('[string, number?]');
});

it('resolves a tuple type with rest elements', () => {
    const text = `
        type MyTuple = [string, ...number[]];
        type TypeName = MyTuple;
        `;
    const source = ts.createSourceFile('in-memory.ts', text, ts.ScriptTarget.Latest);
    const typeDefinition: string | undefined = compiler.findAndResolveType('MyTuple', source);
    expect(typeDefinition).toBe('[string, ...number[]]');
});

it('correctly resolves discriminated unions', () => {
    const text = `
            interface Square {
                kind: "square";
                size: number;
            }
            interface Rectangle {
                kind: "rectangle";
                width: number;
                height: number;
            }
            type Shape = Square | Rectangle;
        `;
    const source = ts.createSourceFile('in-memory.ts', text, ts.ScriptTarget.Latest);
    const typeDefinition: string | undefined = compiler.findAndResolveType('Shape', source);
    expect(typeDefinition).toBe('{ kind: "square"; size: number } | { kind: "rectangle"; width: number; height: number }');
});
});