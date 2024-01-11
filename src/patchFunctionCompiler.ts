import * as ts from "typescript";
import { SourceFile } from "typescript";
import * as fs from "fs";
import * as path from "path";
import { FunctionDescription } from "./models/functionDescription";
import { FunctionType } from "./models/functionType";
import { JSONSchema, Token, TokenStream } from "./models/jsonSchema";

class PatchFunctionCompiler {


  private readonly sourceFiles: ReadonlyArray<ts.SourceFile>;
  private typeChecker: ts.TypeChecker;
  private typeDefinitions: Record<string, string> = {};

  // Default output directory
  private static defaultDistDirectory = 'dist';

  // Optional configuration path
  private static configPath = 'config.json';
  constructor(private program: ts.Program) {
    this.typeChecker = program.getTypeChecker();
    this.sourceFiles = program.getSourceFiles();
  }

  compile(): void {
    const files: ts.SourceFile[] = this.findFilesWithPatchFunctions();
    const patchFunctions: FunctionDescription[] = [];

    // First, populate type definitions
    files.forEach(file => {
      ts.forEachChild(file, node => this.extractTypeDefinitions(node));
    });

    // Then, extract patch functions using the populated type definitions
    files.forEach(file => {
      ts.forEachChild(file, node => {
        this.visit(node, patchFunctions);
      });
    });

    patchFunctions.forEach(pf => {

      const inputTypeDefinitionTokenStream = this.tokenizeTypeScriptType(
        <string>pf.inputTypeDefinition
      );

      const outputTypeDefinitionTokenStream = this.tokenizeTypeScriptType(
        <string>pf.outputTypeDefinition
      );

      pf.inputTypeSchema = this.parseTypeScriptTokens(
        pf.name,
        inputTypeDefinitionTokenStream
      );

      pf.outputTypeSchema = this.parseTypeScriptTokens(
        pf.name,
        outputTypeDefinitionTokenStream
      );

    });

    this.writeToJSON(patchFunctions);
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
      return tokens[currentTokenIndex];
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

      // Handle primitive types (number, string, boolean)
      const primitiveTypes = ['number', 'string', 'boolean', 'null'];
      if (primitiveTypes.includes(token)) {
        return { type: token };
      } else {
        return schema;
      }
    }

    function parseType(): JSONSchema {
      const token = getNextToken();

      // Check for array types (e.g., 'string[]')
      if (token.endsWith('[]')) {
        const itemType = token.substring(0, token.length - 2).trim();
        return {
          type: 'array',
          items: { type: itemType }
        };
      }

      if (token === '{') {
        return parseObject();
      } else if (token.includes('|')) {
        const types = token.split('|').map(s => s.trim().replace(/"/g, ''));
        // Check if one of the union types is 'Date'
        if (types.includes('Date')) {
          return types.length === 1
            ? { type: 'string', format: 'date-time' }
            : { oneOf: types.map(t => t === 'Date' ? { type: 'string', format: 'date-time' } : { type: t }) };
        }
        return {
          type: 'string',
          enum: types
        };
      } else if (token.includes('&')) {
        const types = token.split('&').map(s => s.trim().replace(/"/g, ''));
        return { allOf: types.map(t => ({ type: t })) };

      } else if (token.trim() === 'any') {
        return {};
      } else if (token.trim().startsWith('Record')) {
        return {
          type: 'object',
          additionalProperties: true
        };
      } else if (token.trim() === 'Date') {
        return { type: 'string', format: 'date-time' };
      } else {
        return { type: token.trim() };
      }
    }


    const schema = parseObject();
    schema.$id = name;
    schema.$schema = "http://json-schema.org/draft-07/schema#";

    return schema;
  }

  extractTypeDefinitions(node: ts.Node): void {
    if (ts.isTypeAliasDeclaration(node)) {
      const typeName = node.name.text;
      const typeDefinition = node.type.getText();
      this.typeDefinitions[typeName] = typeDefinition;
    }
    ts.forEachChild(node, child => this.extractTypeDefinitions(child));
  }
  visit(node: ts.Node, patchFunctions: FunctionDescription[]): void {
    if (ts.isClassDeclaration(node)) {
      node.members.forEach(member => {
        if (
          ts.isPropertyDeclaration(member) &&
          member.initializer &&
          ts.isTaggedTemplateExpression(member.initializer)
        ) {
          const tag = member.initializer.tag;
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          const tagExpression = (tag as any).expression;

          if (
            tagExpression &&
            ts.isIdentifier(tagExpression) &&
            tagExpression.escapedText === 'patch'
          ) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const functionName = (member.initializer.parent as any).symbol
              .escapedName;
            //const qualifiedFunctionName = (member as any).symbol.parent.escapedName + '.' + functionName;
            const patchFunction = this.extractPatchFunction(
              member,
              functionName
            );
            if (patchFunction) {
              patchFunctions.push(patchFunction);
            }
          }
        }
      });
    }
    ts.forEachChild(node, child => this.visit(child, patchFunctions));
  }

  extractPatchFunction(
    node: ts.Node,
    functionName: string
  ): FunctionDescription | null {
    if (
      ts.isPropertyDeclaration(node) &&
      node.initializer &&
      ts.isTaggedTemplateExpression(node.initializer)
    ) {
      console.log('Found tagged template expression');

      const name = functionName; // Use the passed function name
      const docstringWithTicks = node.initializer.template.getText();
      const docstring = docstringWithTicks.replace(/`/g, '');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const typeArguments: any[] = (node.initializer.tag as any).typeArguments;
      if (typeArguments && typeArguments.length === 2) {
        console.log('Found type arguments');

        const outputTypeNode: ts.Node = typeArguments[0];
        const inputTypeNode: ts.Node = typeArguments[1];

        const inputType = inputTypeNode.getText(); // Get the textual representation of the input type
        const outputType = outputTypeNode.getText(); // Get the textual representation of the output type

        const inputTypeDefinition = this.extractTypeDefinition(inputType);
        const outputTypeDefinition = this.extractTypeDefinition(outputType);

        const type = (!outputTypeDefinition.startsWith('Embedding')) ? FunctionType.SYMBOLIC : FunctionType.EMBEDDABLE

        return new FunctionDescription(
          name,
          docstring,
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
  extractTypeDefinition(type: string): string {
    for (const sourceFile of this.sourceFiles) {
      const definition = this.findAndResolveType(type, sourceFile);
      if (definition != undefined) {
        return definition;
      }
    }
    return type;
  }

  findAndResolveType(
    inputType: string,
    sourceFile: ts.SourceFile
  ): undefined | string {
    const typeAliases = new Map<string, ts.TypeNode>();
    const interfaces = new Map<string, ts.InterfaceDeclaration>();
    const enums = new Map<string, ts.EnumDeclaration>();

    // Find all type aliases and interfaces
    sourceFile.forEachChild(node => {
      if (ts.isTypeAliasDeclaration(node)) {
        typeAliases.set(node.name.text, node.type);
      } else if (ts.isInterfaceDeclaration(node)) {
        interfaces.set(node.name.text, node);
      } else if (ts.isEnumDeclaration(node)) {
        enums.set(node.name.text, node);
      }
    });

    // Iterate through the children of the source file to find and resolve the type
    for (const node of sourceFile.statements) {
      if (ts.isTypeAliasDeclaration(node) && inputType === node.name.text) {
        return this.resolveType(node.type, typeAliases, interfaces, enums);
      } else if (
        ts.isInterfaceDeclaration(node) &&
        inputType === node.name.text
      ) {
        const members = node.members.map(member =>
          this.resolveTypeMember(member, typeAliases, interfaces, enums)
        );

        return this.renderInterface(members);
      }
    }
  }

  resolveType(
    node: ts.TypeNode,
    typeAliases: Map<string, ts.TypeNode>,
    interfaces: Map<string, ts.InterfaceDeclaration>,
    enums: Map<string, ts.EnumDeclaration>,
    concreteTypes: Map<string, string> = new Map()
  ): string {
    if (ts.isTypeReferenceNode(node)) {
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
    } else if (ts.isTypeLiteralNode(node) || ts.isInterfaceDeclaration(node)) {
      const members = ts.isTypeLiteralNode(node) ? node.members : node.members;
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
    } else if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
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
    if (ts.isTypeAliasDeclaration(typeDeclaration)) {
      // For TypeAliasDeclaration, use the 'type' property
      return this.resolveType(
        typeDeclaration.type,
        typeAliases,
        interfaces,
        enums,
        new Map([['T', resolvedTypeArgs[0]]])
      );
    } else if (ts.isInterfaceDeclaration(typeDeclaration)) {
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
    } else if (ts.isEnumDeclaration(typeDeclaration)) {
      // For EnumDeclaration, handle by iterating over its members
      /* const /*enumMembers = typeDeclaration.members
         .map(member => member.name.getText())
         .join(', ');
       return `{ ${enumMembers} }`;*/

      const enumMembers = typeDeclaration.members.map(member => {
        // If the enum member has an initializer, use it to get the value
        if (member.initializer) {
          if (ts.isNumericLiteral(member.initializer)) {
            return this.renderNumericEnumMember(member);
          } else if (ts.isStringLiteral(member.initializer)) {
            return this.renderNonNumericEnumMember(member);
          }
        }
        return member.name.getText();
      });

      return this.renderEnum(enumMembers);
    } else if (ts.isTypeNode(typeDeclaration)) {
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
    if (member.initializer && ts.isStringLiteral(member.initializer)) {
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
    if (member.initializer && ts.isNumericLiteral(member.initializer)) {
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
    if (ts.isPropertySignature(member)) {
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
      if (ts.isInterfaceDeclaration(typeDeclaration)) {
        // Resolve an interface declaration
        const members = typeDeclaration.members.map(member =>
          this.resolveTypeMember(member, typeAliases, interfaces, enums)
        );

        return this.renderInterface(members);
      } else if (ts.isTypeAliasDeclaration(typeDeclaration)) {
        // Resolve a type alias
        return this.resolveType(
          typeDeclaration.type,
          typeAliases,
          interfaces,
          enums
        );
      }
      if (ts.isEnumDeclaration(typeDeclaration)) {
        // Resolve enum
        const enumMembers = typeDeclaration.members.map(member => {
          // If the enum member has an initializer, use it to get the value
          if (member.initializer) {
            if (ts.isNumericLiteral(member.initializer)) {
              return this.renderNumericEnumMember(member);
            } else if (ts.isStringLiteral(member.initializer)) {
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
    if (ts.isTypeReferenceNode(typeNode)) {
      const typeName = typeNode.typeName.getText();

      // Assuming generic type placeholders like T, U, V, etc.
      // Maps 'T' to 0, 'U' to 1, 'V' to 2, etc.
      if (typeName.length === 1 && typeName >= 'T' && typeName <= 'Z') {
        return typeName; //.charCodeAt(0) - 'T'.charCodeAt(0);
      }
    }

    return null; // Not a generic placeholder
  }

  findFilesWithPatchFunctions(): SourceFile[] {
    const sourceFilesWithPatchFunctions: Set<SourceFile> =
      new Set<SourceFile>();
    this.sourceFiles.forEach(sourceFile => {
      // Check if the source file contains a patch function
      if (sourceFile.fileName.includes('node_modules')) return;
      //if (sourceFile.fileName.includes('test')) return;

      if (this.hasPatchFunction(sourceFile)) {
        // Process the source file to extract patch functions
        ts.forEachChild(sourceFile, node => {
          sourceFilesWithPatchFunctions.add(sourceFile);
        });
      }
    });
    return Array.from(sourceFilesWithPatchFunctions.values());
  }

  /**
   * Determines if a given source file contains a patch function.
   *
   * @param sourceFile A TypeScript source file object.
   * @returns `true` if the source file contains a patch function, otherwise `false`.
   */
  hasPatchFunctionOld(sourceFile: ts.SourceFile): boolean {
    let hasPatch = false;

    ts.forEachChild(sourceFile, node => {
      if (ts.isClassDeclaration(node) && node.members) {
        for (const member of node.members) {
          if (ts.isPropertyDeclaration(member) && member.initializer) {
            if (ts.isTaggedTemplateExpression(member.initializer)) {
              const tag = member.initializer.tag;

              if (ts.isIdentifier(tag) && tag.escapedText === 'patch') {
                hasPatch = true;
                return;
              }
            }
          }
        }
      }
    });

    return hasPatch;
  }

  hasPatchFunction(sourceFile: ts.SourceFile): boolean {
    let hasPatch = false;

    function checkNode(node: ts.Node) {
      if (ts.isIdentifier(node) && node.escapedText === 'patch') {
        hasPatch = true;
      } else {
        ts.forEachChild(node, checkNode);
      }
    }

    ts.forEachChild(sourceFile, checkNode);

    return hasPatch;
  }

  writeToJSON(patchFunctions: FunctionDescription[]): void {
    // Determine the output directory
    const distDirectory = PatchFunctionCompiler.getDistDirectory();

    // Ensure the dist directory exists
    if (!fs.existsSync(distDirectory)) {
      fs.mkdirSync(distDirectory, { recursive: true });
    }

    // Define the output file path within the dist directory
    const outputPath = path.join(distDirectory, 'output.json');

    // Convert the patch functions to JSON format
    const jsonContent = JSON.stringify(patchFunctions, null, 2);

    // Write the JSON content to the output file
    fs.writeFileSync(outputPath, jsonContent);
  }

  static loadFromJSON(): FunctionDescription[] {
    // Define the input file path (assumed to be the same as output path in writeToJSON)
    const distDirectory = PatchFunctionCompiler.getDistDirectory();
    const inputPath = path.join(distDirectory, 'output.json');

    // Check if the file exists
    if (!fs.existsSync(inputPath)) {
      throw new Error('JSON file does not exist.');
    }

    // Read the JSON content from the file
    const jsonContent = fs.readFileSync(inputPath, 'utf8');

    // Parse the JSON content and convert it to FunctionDescription objects
    const patchFunctions = JSON.parse(jsonContent) as FunctionDescription[];

    return patchFunctions;
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
    return members.join(node.kind === ts.SyntaxKind.UnionType ? ' | ' : ' & ');
  }

  private renderLiterals(members: string[]) {
    return `{ ${members.join('; ')} }`;
  }

  private renderInterface(members: string[]) {
    return `{ ${members.join('; ')} }`;
  }

  private renderEnum(enumMembers: string[]) {
    const enumString = `"${enumMembers.join('" | "')}"`;
    return enumString;
  }
}

export default PatchFunctionCompiler;
