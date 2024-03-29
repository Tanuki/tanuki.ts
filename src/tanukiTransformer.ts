import { PluginConfig, TransformerExtras } from 'ts-patch';
import * as fs from 'fs';
import * as path from 'path';
import type * as ts from 'typescript';
import { Expression, SourceFile } from 'typescript';
import crypto from 'crypto';

// This unfortunately has to be defined twice - also in src/constants.ts.
// This is because this code is run at compile time, before the constants are loaded.
const REGISTERED_FUNCTIONS_FILENAME = 'functions.jsonl';

enum FunctionType {
  SYMBOLIC = 'symbolic',
  EMBEDDABLE = 'embeddable',
}

export type Token = string;
export type TokenStream = Token[];

export interface JSONSchema {
  type?: string | string[];
  properties?: { [key: string]: JSONSchema };
  items?: JSONSchema | JSONSchema[];
  enum?: Array<string | number | null>;
  additionalProperties?: boolean | JSONSchema;
  format?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  required?: string[];
  allOf?: JSONSchema[];
  anyOf?: JSONSchema[];
  oneOf?: JSONSchema[];
  not?: JSONSchema;
  $id?: string;
  $ref?: string;
  $schema?: string;
  definitions?: Record<string, JSONSchema>;
  // Add other JSON Schema keywords as needed
  [key: string]: any;
}

class CompiledFunctionDescription {
  name: string;
  docstring: string;
  parentName?: string;
  sourceFile?: string;
  inputTypeDefinition?: string;
  inputTypeSchema?: JSONSchema;
  outputTypeDefinition?: string;
  outputTypeSchema?: JSONSchema;
  type: FunctionType = FunctionType.SYMBOLIC;

  constructor(
    name: string,
    docstring: string,
    parentName?: string,
    sourceFile?: string,
    inputTypeDefinition?: string,
    outputTypeDefinition?: string,
    inputTypeSchema?: JSONSchema,
    outputTypeSchema?: JSONSchema,
    type: FunctionType = FunctionType.SYMBOLIC
  ) {
    this.name = name;
    this.docstring = docstring;
    if (parentName != undefined) {
      this.parentName = parentName;
    }
    if (sourceFile != undefined) {
      this.sourceFile = sourceFile;
    }
    if (inputTypeDefinition != null) {
      this.inputTypeDefinition = inputTypeDefinition;
    }
    if (outputTypeDefinition != null) {
      this.outputTypeDefinition = outputTypeDefinition;
    }
    if (inputTypeSchema != null) {
      this.inputTypeSchema = inputTypeSchema;
    }
    if (outputTypeSchema != null) {
      this.outputTypeSchema = outputTypeSchema;
    }
    //this.inputTypeSchema = inputTypeSchema;
    //this.outputTypeSchema = outputTypeSchema;
    this.type = type;
  }

  hash(purpose: 'general' | 'finetune' = 'general'): string {
    const jsonEncoded = JSON.stringify(this);
    if (purpose === 'general') {
      return crypto.createHash('md5').update(jsonEncoded).digest('hex');
    } else if (purpose === 'finetune') {
      return crypto
        .createHash('shake256', { outputLength: 8 })
        .update(jsonEncoded)
        .digest('hex');
    }
    throw new Error('Invalid hashing purpose');
  }
}

export class PatchFunctionCompiler {
  private readonly sourceFiles: ReadonlyArray<ts.SourceFile>;
  //rivate typeChecker: ts.TypeChecker;
  private typeDefinitions: Record<string, string> = {};

  // Default output directory
  private static defaultDistDirectory = 'dist';

  // Optional configuration path
  private static configPath = 'config.json';

  private ts: typeof ts;

  private compiledFunctionNames: string[];
  private currentScope: ts.Node[] = [];
  private currentClassOrModule:
    | ts.ClassDeclaration
    | ts.ModuleDeclaration
    | null = null;

  constructor(private program: ts.Program, tsInstance: typeof ts) {
    //this.typeChecker = program.getTypeChecker();
    this.sourceFiles = program.getSourceFiles();
    this.ts = tsInstance;
    this.compiledFunctionNames = [];
  }

  compile(file: ts.SourceFile): void {
    if (!this.doesFileContainPatchFunctions(file)) {
      return;
    }
    console.debug('Compiling ' + file.fileName);
    const patchFunctions: CompiledFunctionDescription[] = [];

    // First, populate type definitions
    this.ts.forEachChild(file, node => this.extractTypeDefinitions(node));

    // Then, extract patch functions using the populated type definitions
    this.ts.forEachChild(file, node => {
      this.visit(node, patchFunctions, file);
    });

    // Finally, compile the type definitions into JSON schemas
    patchFunctions.forEach(pf => {
      const inputTypeDefinitionTokenStream = this.tokenizeTypeScriptType(
        <string>pf.inputTypeDefinition
      );

      const outputTypeDefinitionTokenStream = this.tokenizeTypeScriptType(
        <string>pf.outputTypeDefinition
      );

      pf.outputTypeSchema = this.parseTypeScriptTokens(
        pf.name,
        outputTypeDefinitionTokenStream
      );

      pf.inputTypeSchema = this.parseTypeScriptTokens(
        pf.name,
        inputTypeDefinitionTokenStream
      );
      /*const name = pf.name
      if (this.compiledFunctionNames.indexOf(name) > -1) {
        throw new Error("Function name collision in `"+file.fileName+".\nPlease move `"+name+"` into its own namespace. Tanuki functions have to be unique across all files. ")
      }*/

      this.compiledFunctionNames.push(pf.name);
    });

    if (patchFunctions.length > 0) {
      console.log(
        'Found ' +
          patchFunctions.length +
          ' patched functions in ' +
          file.fileName
      );
      this.writeToJSON(patchFunctions);
    }
  }

  tokenizeTypeScriptType(typeString: string): TokenStream {
    const regex = /{|}|\|| (\w+):|[^{};:]+|;/g;
    const tokens: TokenStream = [];
    let match;

    while ((match = regex.exec(typeString)) !== null) {
      tokens.push(match[0].trim());
    }

    return tokens.filter(token => token); // Filter out empty tokens
  }

  parseTypeScriptTokens(name: string, tokens: TokenStream): JSONSchema {
    let currentTokenIndex = 0;

    function getNextToken(): Token {
      return tokens[currentTokenIndex++];
    }

    function peekNextToken(): Token {
      return currentTokenIndex < tokens.length
        ? tokens[currentTokenIndex]
        : tokens[currentTokenIndex - 1];
    }

    function parseObject(): JSONSchema {
      const schema: JSONSchema = { type: 'object', properties: {} };
      let token = getNextToken();

      while (token !== '}' && currentTokenIndex < tokens.length) {
        if (/\w+:/.exec(token)) {
          const propertyName = token.replace(':', '').trim();
          schema.properties![propertyName] = parseType();
        }
        token = getNextToken();
      }

      if (/("([^"]+)"\s*\|\s*)+"([^"]+)"/.exec(token)) {
        return parseType();
      }

      // Check for array types (e.g., 'string[]')
      if (token.endsWith('[]')) {
        const itemType = token.substring(0, token.length - 2).trim();
        return {
          type: 'array',
          items: { type: itemType },
        };
      }
      // Handle primitive types (number, string, boolean)
      const primitiveTypes = ['number', 'string', 'boolean', 'null'];
      if (primitiveTypes.includes(token)) {
        return { type: token };
      } else {
        return schema;
      }
    }

    function parseType(): JSONSchema {
      let token = peekNextToken();
      if (!peekNextToken()) {
        token = getNextToken();
      }

      if (token === '{') {
        return parseObject();
      } else if (token.includes('|')) {
        const types = token.split('|').map(s => s.trim().replace(/"/g, ''));
        // Check if one of the union types is 'Date'
        if (types.includes('Date')) {
          return types.length === 1
            ? { type: 'string', format: 'date-time' }
            : {
                oneOf: types.map(t =>
                  t === 'Date'
                    ? { type: 'string', format: 'date-time' }
                    : { type: t }
                ),
              };
        }
        if (types.includes('null')) {
          types.splice(types.indexOf('null'), 1);
          return {
            oneOf: [{ type: 'null' }, { type: 'string', enum: types }],
          };
        }
        return {
          type: 'string',
          enum: types,
        };
      } else if (token.includes('&')) {
        const types = token.split('&').map(s => s.trim().replace(/"/g, ''));
        return { allOf: types.map(t => ({ type: t })) };
      } else if (token.trim() === 'any') {
        return {};
      } else if (token.trim().startsWith('Record')) {
        return {
          type: 'object',
          additionalProperties: true,
        };
      } else if (token.trim() === 'Date') {
        return { type: 'string', format: 'date-time' };
      } else {
        return { type: token.trim() };
      }
    }

    const schema = parseObject();
    schema.$id = name;
    schema.$schema = 'http://json-schema.org/draft-07/schema#';

    return schema;
  }

  extractTypeDefinitions(node: ts.Node): void {
    if (this.ts.isTypeAliasDeclaration(node)) {
      const typeName = node.name.text;
      const typeDefinition = node.type.getText();
      this.typeDefinitions[typeName] = typeDefinition;
    }
    this.ts.forEachChild(node, child => this.extractTypeDefinitions(child));
  }
  visit(
    node: ts.Node,
    patchFunctions: CompiledFunctionDescription[],
    file: ts.SourceFile
  ): void {
    if (this.ts.isClassDeclaration(node) || this.ts.isModuleDeclaration(node)) {
      const previousClassOrModule = this.currentClassOrModule;
      this.currentClassOrModule = node;

      if ('members' in node) {
        node.members.forEach(member => {
          if (
            this.ts.isPropertyDeclaration(member) &&
            member.initializer &&
            this.ts.isTaggedTemplateExpression(member.initializer)
          ) {
            const tag = member.initializer.tag;

            // @ts-ignore
            const tagExpression = tag.expression as Expression;

            if (
              tagExpression &&
              this.ts.isIdentifier(tagExpression) &&
              this.getNodeText(tagExpression) === 'patch'
            ) {
              const functionName = (member.name as ts.Identifier).text;
              const patchFunction = this.extractPatchFunction(
                member,
                functionName,
                file,
                this.currentClassOrModule
              );

              if (patchFunction) {
                patchFunctions.push(patchFunction);
              }
            }
          }
        });
      }

      this.currentClassOrModule = previousClassOrModule;
    } else {
      this.ts.forEachChild(node, child =>
        this.visit(child, patchFunctions, file)
      );
    }
  }

  isNodeStatic(node: ts.Node, _ts: typeof ts): boolean {
    // Node types that can have modifiers
    if (
      _ts.isMethodDeclaration(node) ||
      _ts.isPropertyDeclaration(node) ||
      _ts.isConstructorDeclaration(node) ||
      _ts.isGetAccessor(node) ||
      _ts.isSetAccessor(node)
    ) {
      if (node.modifiers != undefined) {
        return node.modifiers.some(
          modifier => modifier.kind === _ts.SyntaxKind.StaticKeyword
        );
      }
    }
    return false;
  }

  extractPatchFunction(
    node: ts.Node,
    functionName: string,
    file: ts.SourceFile,
    currentClassOrModule: ts.ClassDeclaration | ts.ModuleDeclaration | null
  ): CompiledFunctionDescription | null {
    console.trace(currentClassOrModule);
    if (
      this.ts.isPropertyDeclaration(node) &&
      node.initializer &&
      this.ts.isTaggedTemplateExpression(node.initializer)
    ) {
      //let parent = '';
      if (
        node.parent &&
        node.parent.name &&
        this.ts.isClassDeclaration(node.parent)
      ) {
        if (node.parent.name.getText() === 'Function') {
          throw new Error(
            'The class `Function` cannot have patched functions as members, as this is a reserved word. You could rename the class.'
          );
        }
        // @ts-ignore
        //parent = node.parent.name.getText() + '.';
      }
      //const _ts = this.ts;
      this.ts;
      //const staticFlag = isNodeStatic(node, _ts);

      const name = functionName; // Use the passed function name

      const docstringWithTicks = node.initializer.template.getText();
      const docstring = docstringWithTicks.replace(/`/g, '');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const typeArguments: any[] = (node.initializer.tag as any).typeArguments;
      if (typeArguments && typeArguments.length === 2) {
        //console.log('Found type arguments');

        const outputTypeNode: ts.Node = typeArguments[0];
        const inputTypeNode: ts.Node = typeArguments[1];

        const inputType = inputTypeNode.getText(file); // Get the textual representation of the input type
        const outputType = outputTypeNode.getText(file); // Get the textual representation of the output type

        const current = this.currentClassOrModule;
        const inputTypeDefinition = this.extractTypeDefinition(
          inputType,
          current,
          file
        );
        const outputTypeDefinition = this.extractTypeDefinition(
          outputType,
          current,
          file
        );

        const type = !outputTypeDefinition.startsWith('Embedding')
          ? FunctionType.SYMBOLIC
          : FunctionType.EMBEDDABLE;
        //name = current?.name?.getText() + "." + name
        // @ts-ignore
        const parentName = current.name.getText();
        return new CompiledFunctionDescription(
          name,
          docstring,
          parentName,
          file.fileName,
          inputTypeDefinition,
          outputTypeDefinition,
          undefined,
          undefined,
          type
        );
      } else {
        console.log('Type arguments not found or not in expected format');
      }
    } else {
      console.log(
        'Node is not a property declaration with a tagged template expression'
      );
    }

    return null;
  }
  extractTypeDefinition(
    type: string,
    currentScope: ts.Node | null,
    file: SourceFile
  ): string {
    // If the type is a primitive type, return it
    const primitiveTypes = ['number', 'string', 'boolean', 'null'];
    if (primitiveTypes.includes(type)) {
      return type;
    }
    /*if (currentScope) {
      if (type == "ActionItem[]") {
        console.log("here")
      }
      const currentSourceFile = currentScope.getSourceFile();
      const def = this.findAndResolveType(type, currentSourceFile)
      if (def) {
        return def
      }
    }*/
    // Next, try to resolve the type in the current scope
    let definition = currentScope
      ? this.findAndResolveTypeInScope(type, currentScope)
      : undefined;
    if (definition) {
      return definition;
    }
    if (currentScope) {
      definition = this.findAndResolveType(type, file);
      if (definition) {
        return definition;
      }
    }
    for (const sourceFile of this.sourceFiles) {
      const definition = this.findAndResolveType(type, sourceFile);
      if (definition != undefined) {
        return definition;
      }
    }
    return type;
  }

  /**
   * Takes in the string representation of a Typescript type, and attempts to resolve
   * into a string representation of type definition composed of primitive types by
   * searching through the scope node.
   * @param inputType The string representation of a Typescript type.
   * @param scopeNode The scope node to search for the type definition.
   */
  findAndResolveTypeInScope(
    inputType: string,
    scopeNode: ts.Node
  ): undefined | string {
    const typeAliases = new Map<string, ts.TypeNode>();
    const interfaces = new Map<string, ts.InterfaceDeclaration>();
    const enums = new Map<string, ts.EnumDeclaration>();

    scopeNode.forEachChild(node => {
      if (this.ts.isTypeAliasDeclaration(node)) {
        typeAliases.set(node.name.text, node.type);
      } else if (this.ts.isInterfaceDeclaration(node)) {
        interfaces.set(node.name.text, node);
      } else if (this.ts.isEnumDeclaration(node)) {
        enums.set(node.name.text, node);
      }
    });

    let resolvedType: string | undefined = undefined;

    scopeNode.forEachChild(node => {
      if (
        this.ts.isTypeAliasDeclaration(node) &&
        inputType === node.name.text
      ) {
        resolvedType = this.resolveType(
          node.type,
          typeAliases,
          interfaces,
          enums
        );
      } else if (
        this.ts.isInterfaceDeclaration(node) &&
        inputType === node.name.text
      ) {
        const members = node.members.map(member =>
          this.resolveTypeMember(member, typeAliases, interfaces, enums)
        );
        resolvedType = this.renderInterface(members);
      } else if (
        this.ts.isEnumDeclaration(node) &&
        inputType === node.name.text
      ) {
        const members = node.members.map(member =>
          this.resolveType(member, typeAliases, interfaces, enums)
        );
        resolvedType = this.renderEnum(members);
      } else if (
        this.ts.isClassDeclaration(node) &&
        node.name &&
        inputType === node.name.text
      ) {
        const members = node.members.map(member =>
          this.resolveClassMember(member, typeAliases, interfaces, enums)
        );
        resolvedType = this.renderInterface(members);
      }
    });

    return resolvedType;
  }

  /**
   * Takes in the string representation of a Typescript type, and attempts to resolve
   * into a string representation of type definition composed of primitive types by
   * searching through the source file.
   * @param inputType
   * @param sourceFile
   */
  findAndResolveType(
    inputType: string,
    sourceFile: ts.SourceFile
  ): undefined | string {
    const typeAliases = new Map<string, ts.TypeNode>();
    const interfaces = new Map<string, ts.InterfaceDeclaration>();
    const enums = new Map<string, ts.EnumDeclaration>();

    // Find all type aliases and interfaces
    sourceFile.forEachChild(node => {
      if (this.ts.isTypeAliasDeclaration(node)) {
        typeAliases.set(node.name.text, node.type);
      } else if (this.ts.isInterfaceDeclaration(node)) {
        interfaces.set(node.name.text, node);
      } else if (this.ts.isEnumDeclaration(node)) {
        enums.set(node.name.text, node);
      } else if (this.ts.isClassDeclaration(node)) {
        if (node.name) {
          // @ts-ignore
          typeAliases.set(node.name.text, node);
        }
      }
    });

    // Iterate through the children of the source file to find and resolve the type
    for (const node of sourceFile.statements) {
      if (
        this.ts.isTypeAliasDeclaration(node) &&
        inputType === node.name.text
      ) {
        return this.resolveType(node.type, typeAliases, interfaces, enums);
      } else if (
        this.ts.isInterfaceDeclaration(node) &&
        inputType === node.name.text
      ) {
        const members = node.members.map(member =>
          this.resolveTypeMember(member, typeAliases, interfaces, enums)
        );
        return this.renderInterface(members);
      } else if (
        this.ts.isEnumDeclaration(node) &&
        inputType === node.name.text
      ) {
        const members = node.members.map(member => {
          return this.resolveType(member, typeAliases, interfaces, enums);
        });
        return this.renderEnum(members);
      } else if (
        this.ts.isClassDeclaration(node) &&
        node.name &&
        inputType === node.name.text
      ) {
        const members = node.members.map(member =>
          this.resolveClassMember(member, typeAliases, interfaces, enums)
        );
        return this.renderInterface(members);
      }
    }
  }

  resolveType(
    node: ts.TypeNode | ts.EnumMember,
    typeAliases: Map<string, ts.TypeNode>,
    interfaces: Map<string, ts.InterfaceDeclaration>,
    enums: Map<string, ts.EnumDeclaration>,
    concreteTypes: Map<string, string> = new Map()
  ): string {
    if (this.ts.isTypeReferenceNode(node)) {
      const typeName = node.typeName.getText();
      const typeDeclaration = typeAliases.get(typeName);

      if (node.typeArguments) {
        const resolvedTypeArgs = node.typeArguments.map(arg =>
          this.resolveType(arg, typeAliases, interfaces, enums, concreteTypes)
        );

        if (typeDeclaration) {
          return this.substituteTypeArguments(
            typeDeclaration,
            resolvedTypeArgs,
            typeAliases,
            interfaces,
            enums
          );
          // Add more checks for other types like classes if needed
        }
      }

      const alias = typeAliases.get(node.typeName.getText());
      return alias
        ? this.resolveType(alias, typeAliases, interfaces, enums, concreteTypes)
        : node.typeName.getText();
    } else if (
      this.ts.isTypeLiteralNode(node) ||
      this.ts.isInterfaceDeclaration(node)
    ) {
      const members = this.ts.isTypeLiteralNode(node)
        ? node.members
        : node.members;
      const membersList = members.map(member =>
        this.resolveTypeMember(
          member,
          typeAliases,
          interfaces,
          enums,
          concreteTypes
        )
      );
      return this.renderLiterals(membersList);
    } else if (
      this.ts.isUnionTypeNode(node) ||
      this.ts.isIntersectionTypeNode(node)
    ) {
      const members = node.types.map(type =>
        this.resolveType(type, typeAliases, interfaces, enums, concreteTypes)
      );
      return this.renderUnion(node, members);
    }
    return node.getText();
  }

  substituteTypeArguments(
    typeDeclaration:
      | ts.TypeAliasDeclaration
      | ts.InterfaceDeclaration
      | ts.TypeNode
      | ts.EnumDeclaration,
    resolvedTypeArgs: string[],
    typeAliases: Map<string, ts.TypeNode>,
    interfaces: Map<string, ts.InterfaceDeclaration>,
    enums: Map<string, ts.EnumDeclaration>
  ): string {
    if (this.ts.isTypeAliasDeclaration(typeDeclaration)) {
      // For TypeAliasDeclaration, use the 'type' property
      return this.resolveType(
        typeDeclaration.type,
        typeAliases,
        interfaces,
        enums,
        new Map([['T', resolvedTypeArgs[0]]])
      );
    } else if (this.ts.isInterfaceDeclaration(typeDeclaration)) {
      // For InterfaceDeclaration, handle by iterating over its members
      const members = typeDeclaration.members.map(member =>
        this.resolveTypeMember(
          member,
          typeAliases,
          interfaces,
          enums,
          new Map([['T', resolvedTypeArgs[0]]])
        )
      );
      return this.renderInterface(members);
    } else if (this.ts.isEnumDeclaration(typeDeclaration)) {
      // For EnumDeclaration, handle by iterating over its members
      /* const /*enumMembers = typeDeclaration.members
         .map(member => member.name.getText())
         .join(', ');
       return `{ ${enumMembers} }`;*/

      const enumMembers = typeDeclaration.members.map(member => {
        // If the enum member has an initializer, use it to get the value
        if (member.initializer) {
          if (this.ts.isNumericLiteral(member.initializer)) {
            return this.renderNumericEnumMember(member);
          } else if (this.ts.isStringLiteral(member.initializer)) {
            return this.renderNonNumericEnumMember(member);
          }
        }
        return member.name.getText();
      });

      return this.renderEnum(enumMembers);
    } else if (this.ts.isTypeNode(typeDeclaration)) {
      // For TypeNode
      const expandedType = this.resolveConcreteType(
        resolvedTypeArgs[0],
        typeAliases,
        interfaces,
        enums
      );
      const resolvedType = this.resolveType(
        typeDeclaration,
        typeAliases,
        interfaces,
        enums,
        new Map([['T', expandedType]])
      );
      return resolvedType;
    }
    // Fallback return for other cases
    return '';
  }

  private renderNonNumericEnumMember(member: ts.EnumMember): string {
    // Check if initializer is present and is a string literal
    if (member.initializer && this.ts.isStringLiteral(member.initializer)) {
      const value = member.initializer.text;
      return `${member.name.getText()} = "${value}"`;
    } else {
      // Handle the case where initializer is not present or not a string literal
      // Return a default representation or throw an error
      return `${member.name.getText()} = ""`;
    }
  }

  private renderNumericEnumMember(member: ts.EnumMember): string {
    // Check if initializer is present and is a numeric literal
    if (member.initializer && this.ts.isNumericLiteral(member.initializer)) {
      const value = member.initializer.text;
      return `${member.name.getText()} = ${value}`;
    } else {
      // Handle the case where initializer is not present or not a numeric literal
      // Return a default representation or throw an error
      return `${member.name.getText()} = 0`;
    }
  }

  resolveTypeMember(
    member: ts.TypeElement,
    typeAliases: Map<string, ts.TypeNode>,
    interfaces: Map<string, ts.InterfaceDeclaration>,
    enums: Map<string, ts.EnumDeclaration>,
    concreteTypes: Map<string, string> = new Map()
  ): string {
    if (this.ts.isPropertySignature(member)) {
      const propertyName = member.name.getText();
      let propertyType = 'any'; // Default type

      if (member.type) {
        const memberTypeName = member.type.getText();
        // Check if the type is an enum and resolve it
        if (enums.has(memberTypeName)) {
          propertyType = this.resolveConcreteType(
            memberTypeName,
            typeAliases,
            interfaces,
            enums
          );
        } else {
          propertyType = this.resolveType(
            member.type,
            typeAliases,
            interfaces,
            enums,
            concreteTypes
          );

          // Substitute generic type argument if applicable
          const genericIndex = this.getGenericPlaceholderIndex(member.type);
          if (genericIndex !== null) {
            propertyType = concreteTypes.get(genericIndex) || propertyType;
          }
        }
      }

      return `${propertyName}: ${propertyType}`;
    }

    // TODO: Implement handling for other member types (methods, index signatures, etc.)

    return ''; // Fallback for unhandled member types
  }
  resolveClassMember(
    member: ts.ClassElement,
    typeAliases: Map<string, ts.TypeNode>,
    interfaces: Map<string, ts.InterfaceDeclaration>,
    enums: Map<string, ts.EnumDeclaration>,
    concreteTypes: Map<string, string> = new Map()
  ): string {
    if (this.ts.isPropertyDeclaration(member)) {
      // Handle property declarations
      const propertyName = member.name.getText();
      let propertyType = 'any'; // Default type

      if (member.type) {
        //const memberTypeName = member.type.getText();
        // Resolve property type similar to resolveTypeMember
        propertyType = this.resolveType(
          member.type,
          typeAliases,
          interfaces,
          enums,
          concreteTypes
        );
      }

      return `${propertyName}: ${propertyType}`;
    } else if (this.ts.isMethodDeclaration(member)) {
      // Handle method declarations
      const methodName = member.name.getText();
      let returnType = 'void'; // Default return type

      if (member.type) {
        returnType = this.resolveType(
          member.type,
          typeAliases,
          interfaces,
          enums,
          concreteTypes
        );
      }

      // Assuming we don't handle parameters in this example
      return `${methodName}(): ${returnType}`;
    }

    // TODO: Implement handling for other class member types

    return ''; // Fallback for unhandled class member types
  }

  resolveConcreteType(
    typeName: string,
    typeAliases: Map<string, ts.TypeNode>,
    interfaces: Map<string, ts.InterfaceDeclaration>,
    enums: Map<string, ts.EnumDeclaration>
  ): string {
    const typeDeclaration =
      typeAliases.get(typeName) ||
      interfaces.get(typeName) ||
      enums.get(typeName);
    if (typeDeclaration) {
      if (this.ts.isInterfaceDeclaration(typeDeclaration)) {
        // Resolve an interface declaration
        const members = typeDeclaration.members.map(member =>
          this.resolveTypeMember(member, typeAliases, interfaces, enums)
        );

        return this.renderInterface(members);
      } else if (this.ts.isTypeAliasDeclaration(typeDeclaration)) {
        // Resolve a type alias
        return this.resolveType(
          typeDeclaration.type,
          typeAliases,
          interfaces,
          enums
        );
      }
      if (this.ts.isEnumDeclaration(typeDeclaration)) {
        // Resolve enum
        const enumMembers = typeDeclaration.members.map(member => {
          // If the enum member has an initializer, use it to get the value
          if (member.initializer) {
            if (this.ts.isNumericLiteral(member.initializer)) {
              return this.renderNumericEnumMember(member);
            } else if (this.ts.isStringLiteral(member.initializer)) {
              return this.renderNonNumericEnumMember(member);
            }
          }
          return member.name.getText();
        });
        return this.renderEnum(enumMembers);
      }
      // Handle other cases if needed
    }

    return typeName; // Fallback if type not found or not resolvable
  }

  getGenericPlaceholderIndex(typeNode: ts.TypeNode): string | null {
    if (this.ts.isTypeReferenceNode(typeNode)) {
      const typeName = typeNode.typeName.getText();

      // Assuming generic type placeholders like T, U, V, etc.
      // Maps 'T' to 0, 'U' to 1, 'V' to 2, etc.
      if (typeName.length === 1 && typeName >= 'T' && typeName <= 'Z') {
        return typeName; //.charCodeAt(0) - 'T'.charCodeAt(0);
      }
    }

    return null; // Not a generic placeholder
  }

  doesFileContainPatchFunctions(sourceFile: ts.SourceFile): boolean {
    if (sourceFile.fileName.includes('node_modules')) return false;
    if (this.hasPatchFunction(sourceFile)) {
      return true;
    }
    return false;
  }

  findFilesWithPatchFunctions(): SourceFile[] {
    const sourceFilesWithPatchFunctions: Set<SourceFile> =
      new Set<SourceFile>();
    this.sourceFiles.forEach(sourceFile => {
      if (this.doesFileContainPatchFunctions(sourceFile)) {
        // Process the source file to extract patch functions
        this.ts.forEachChild(sourceFile, () => {
          sourceFilesWithPatchFunctions.add(sourceFile);
        });
      }
    });
    return Array.from(sourceFilesWithPatchFunctions.values());
  }

  getNodeText(node: ts.Node): string {
    // @ts-ignore
    return node.escapedText as string;
  }

  hasPatchFunction(sourceFile: ts.SourceFile): boolean {
    let hasPatch = false;
    const _ts = this.ts;

    // eslint-disable-next-line @typescript-eslint/unbound-method
    const _getNodeText = this.getNodeText;
    function checkNode(node: ts.Node) {
      if (_ts.isIdentifier(node) && _getNodeText(node) === 'patch') {
        hasPatch = true;
      } else {
        _ts.forEachChild(node, checkNode);
      }
    }

    this.ts.forEachChild(sourceFile, checkNode);

    return hasPatch;
  }

  writeToJSON(patchFunctions: CompiledFunctionDescription[]): void {
    // Determine the output directory
    const distDirectory = PatchFunctionCompiler.getDistDirectory();

    // Ensure the dist directory exists
    if (!fs.existsSync(distDirectory)) {
      fs.mkdirSync(distDirectory, { recursive: true });
    }

    // Define the output file path within the dist directory
    const outputPath = path.join(distDirectory, REGISTERED_FUNCTIONS_FILENAME);

    // Convert the patch functions to JSON format
    for (const pf of patchFunctions) {
      const jsonContent = JSON.stringify(pf);
      // Write the JSON content to the output file
      fs.appendFileSync(outputPath, jsonContent + '\n', 'utf8');
    }
  }

  clearFile(): void {
    // Determine the output directory
    const distDirectory = PatchFunctionCompiler.getDistDirectory();

    // Ensure the dist directory exists
    if (!fs.existsSync(distDirectory)) {
      fs.mkdirSync(distDirectory, { recursive: true });
    }

    // Define the output file path within the dist directory
    const outputPath = path.join(distDirectory, REGISTERED_FUNCTIONS_FILENAME);

    // Convert the patch functions to JSON format
    fs.writeFileSync(outputPath, '', 'utf8');
  }

  static getDistDirectory(): string {
    // Check for a configuration file
    if (fs.existsSync(PatchFunctionCompiler.configPath)) {
      const config = JSON.parse(
        fs.readFileSync(PatchFunctionCompiler.configPath, 'utf-8')
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return
      return config.distDirectory || PatchFunctionCompiler.defaultDistDirectory;
    }

    // Default to the conventional 'dist' directory
    return PatchFunctionCompiler.defaultDistDirectory;
  }

  /**
   * Here is where we render our types to string.
   */
  private renderUnion(
    node: ts.UnionTypeNode | ts.IntersectionTypeNode,
    members: string[]
  ) {
    return members.join(
      node.kind === this.ts.SyntaxKind.UnionType ? ' | ' : ' & '
    );
  }

  private renderLiterals(members: string[]) {
    return `{ ${members.join('; ')} }`;
  }

  private renderInterface(members: string[]) {
    return `{ ${members.join('; ')} }`;
  }

  private renderEnum(enumMembers: string[]) {
    const enumValues = enumMembers.map(member => {
      // Split the member string at '=' and trim each part
      const parts = member
        .split('=')
        .map(part => part.trim().replace(/^"|"$/g, ''));

      // Use the right-hand side if available, otherwise use the left-hand side
      return parts.length > 1 ? parts[1] : parts[0];
    });
    const enumString = `"${enumValues.join('" | "')}"`;
    return enumString;
  }
}

export default function (
  program: ts.Program,
  pluginConfig: PluginConfig,
  { ts: tsInstance }: TransformerExtras
) {
  console.log('Instantiating Tanuki');
  //const { Tanuki } = require('./tanuki');
  const compiler = new PatchFunctionCompiler(program, tsInstance);
  compiler.clearFile();
  return (ctx: ts.TransformationContext) => {
    //const tanuki = new Tanuki()
    return (sourceFile: ts.SourceFile) => {
      compiler.compile(sourceFile);

      function visit(node: ts.Node): ts.Node {
        return tsInstance.visitEachChild(node, visit, ctx);
      }
      return tsInstance.visitNode(sourceFile, visit);
    };
  };
}
