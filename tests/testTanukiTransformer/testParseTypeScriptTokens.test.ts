import { PatchFunctionCompiler } from '../../src/tanukiTransformer';
import ts from 'typescript';

const minimalTsMock: Partial<typeof ts> = {
  createProgram: jest.fn(),
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
describe('parseTypeScriptTokens', () => {
  let compiler: PatchFunctionCompiler;

  beforeEach(() => {
    compiler = new PatchFunctionCompiler(
      mockProgram,
      minimalTsMock as typeof ts
    );
  });

  it('should parse an array type', () => {
    const tokens = ['string[]'];
    const result = compiler.parseTypeScriptTokens('myArray', tokens);
    expect(result).toEqual({
      $id: 'myArray',
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'array',
      items: {
        type: 'string',
      },
    });
  });

  it('should parse an optional primitive', () => {
    const tokens = ['string?'];
    const result = compiler.parseTypeScriptTokens('myOptional', tokens);
    expect(result).toEqual({
      $id: 'myOptional',
      $schema: 'http://json-schema.org/draft-07/schema#',
      oneOf: [
        {
          type: 'string',
        },
        {
          type: 'null',
        },
      ],
    });
  });

  it('should parse an optional array', () => {
    const tokens = ['string[]?'];
    const result = compiler.parseTypeScriptTokens('myOptionalArray', tokens);
    expect(result).toEqual({
      $id: 'myOptionalArray',
      $schema: 'http://json-schema.org/draft-07/schema#',
      oneOf: [
        {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        {
          type: 'null',
        },
      ],
    });
  });

  it('should parse an optional object', () => {
    const tokens = ['{', 'name:', 'string', ';', 'age:', 'number', '}?'];
    const result = compiler.parseTypeScriptTokens('myOptionalObject', tokens);
    expect(result).toEqual({
      $id: 'myOptionalObject',
      $schema: 'http://json-schema.org/draft-07/schema#',
      oneOf: [
        {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
          },
          required: ['name', 'age'],
        },
        {
          type: 'null',
        },
      ],
    });
  });

  it ('resolves an optional type with undefined', () => {
      const tokens = ['string | undefined'];
      const result = compiler.parseTypeScriptTokens('myOptionalType', tokens);
        expect(result).toEqual({
            $id: 'myOptionalType',
            $schema: 'http://json-schema.org/draft-07/schema#',
            oneOf: [
                {
                    type: 'null',
                },
                {
                    type: 'string',
                },
            ],
        });
  });

    it('should parse a tuple type', () => {
        const tokens = ['[','string', 'number', ']'];
        const result = compiler.parseTypeScriptTokens('myObject', tokens);
        expect(result).toEqual({
            type: "array",
            items: [
                {
                    type: "string"
                },
                {
                    type: "number"
                }
            ],
            $id: "myObject",
            $schema: "http://json-schema.org/draft-07/schema#"
        });
    });

    it('should parse a tuple type with optional elements', () => {
        const tokens = ['[','string', 'number?', ']'];
        const result = compiler.parseTypeScriptTokens('myObject', tokens);
        expect(result).toEqual({
            type: "array",
            items: [
                {
                    type: "string"
                },
                {
                    oneOf: [
                        {
                            type: "number"
                        },
                        {
                            type: "null"
                        }
                    ]
                }
            ],
            $id: "myObject",
            $schema: "http://json-schema.org/draft-07/schema#"
        });
    });

  it('should parse a tuple type with object types', () => {
        const tokens = ['[','string', '{', 'name:', 'number | null', '}', ']'];
        const result = compiler.parseTypeScriptTokens('myObject', tokens);
        expect(result).toEqual({
            type: "array",
            items: [
                {
                    type: "string"
                },
                {
                    type: "object",
                    properties: {
                        name: {
                            oneOf: [
                                {
                                    type: "null"
                                },
                                {
                                    type: "number"
                                }
                            ]
                        }
                    },
                    required: ["name"]
                }
            ],
            $id: "myObject",
            $schema: "http://json-schema.org/draft-07/schema#"
        });

  })

  it('should parse a complex object type', () => {
    const tokens = [
      '{',
      'name:',
      'string',
      ';',
      'age:',
      'number | null',
      ';',
      '}',
    ];
    const result = compiler.parseTypeScriptTokens('myObject', tokens);
    expect(result).toEqual({
      $id: 'myObject',
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { oneOf: [{ type: 'null' }, { type: 'number' }] },
      },
      required: ['name', 'age'],
    });
  });

  it('should parse optional properties in an object', () => {
    const tokens = ['{', 'name?: ', 'string', ';', 'age?: ', 'number', '}'];
    const result = compiler.parseTypeScriptTokens('myOptionalProps', tokens);
    expect(result).toEqual({
      $id: 'myOptionalProps',
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        name: { nullable: true, type: 'string' },
        age: { nullable: true, type: 'number' },
      },
    });
  });

  it('should parse nested object types', () => {
    const tokens = [
      '{',
      'user:',
      '{',
      'name:',
      'string',
      ';',
      'age:',
      'number',
      '}',
      ';',
      '}',
    ];
    const result = compiler.parseTypeScriptTokens('myNestedObject', tokens);
    expect(result).toEqual({
      $id: 'myNestedObject',
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
          },
          required: ['name', 'age'],
        },
      },
      required: ['user'],
    });
  });

  describe('parseUnionType', () => {
    it('handles mixed union of null and string literals', () => {
      const tokens = [
        '{',
        'user:',
        'null | "hello" | "this" | "is" | "an" | "enum"',
        '}',
      ];
      const result = compiler.parseTypeScriptTokens('parseUnionType', tokens);
      expect(result).toEqual({
        type: 'object',
        properties: {
          user: {
            oneOf: [
              {
                type: 'null',
              },
              {
                type: 'string',
                enum: ['hello', 'this', 'is', 'an', 'enum'],
              },
            ],
          },
        },
        required: ['user'],
        $id: 'parseUnionType',
        $schema: 'http://json-schema.org/draft-07/schema#',
      });
    });
    it('handles a union of null and type', () => {
      const tokens = ['{', 'user: ', 'number | null', '}'];
      const result = compiler.parseTypeScriptTokens('parseUnionType', tokens);
      expect(result).toEqual({
        type: 'object',
        properties: {
          user: {
            oneOf: [
              {
                type: 'null',
              },
              {
                type: 'number',
              },
            ],
          },
        },
        required: ['user'],
        $id: 'parseUnionType',
        $schema: 'http://json-schema.org/draft-07/schema#',
      });
    });

    it('handles a union of boolean literals', () => {
      const tokens = ['true | false'];
      const result = compiler.parseTypeScriptTokens('parseUnionType', tokens);
      expect(result).toEqual({
        type: 'boolean',
        $id: 'parseUnionType',
        $schema: 'http://json-schema.org/draft-07/schema#',
      });
    });

    it('handles a union of numeric literals', () => {
      const tokens = ['1 | 2 | 3'];
      const result = compiler.parseTypeScriptTokens('parseUnionType', tokens);
      expect(result).toEqual({
        type: 'number',
        enum: [1, 2, 3],
        $id: 'parseUnionType',
        $schema: 'http://json-schema.org/draft-07/schema#',
      });
    });


  });
});
