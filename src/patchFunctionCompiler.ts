import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { FunctionDescription } from './models/functionDescription';
import { TypeDescription } from './models/typeDescription';
import { FunctionType } from './models/functionType';
import { SourceFile } from 'typescript';

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

    this.writeToJSON(patchFunctions);
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
        if (ts.isPropertyDeclaration(member) && member.initializer && ts.isTaggedTemplateExpression(member.initializer)) {
          const tag = member.initializer.tag;
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          const tagExpression = (tag as any).expression;

          if (tagExpression && ts.isIdentifier(tagExpression) && tagExpression.escapedText === 'patch') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const functionName = (member.initializer.parent as any).symbol.escapedName;
            //const qualifiedFunctionName = (member as any).symbol.parent.escapedName + '.' + functionName;
            const patchFunction = this.extractPatchFunction(member, functionName);
            if (patchFunction) {
              patchFunctions.push(patchFunction);
            }
          }
        }
      });
    }
    ts.forEachChild(node, child => this.visit(child, patchFunctions));
  }

  extractPatchFunction(node: ts.Node, functionName: string): FunctionDescription | null {
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

        return new FunctionDescription(
          name,
          docstring,
          inputTypeDefinition,
          outputTypeDefinition,
          FunctionType.SYMBOLIC
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
  extractTypeDefinition(inputType: string): string {
    for (const sourceFile of this.sourceFiles) {
      const definition = this.findAndResolveType(inputType, sourceFile);
      if (definition != undefined) {
        return definition
      }
    }
    return inputType;
  }

  findAndResolveType(
    inputType: string,
    sourceFile: ts.SourceFile
  ): undefined | string {
    const typeAliases = new Map<string, ts.TypeNode>();
    const interfaces = new Map<string, ts.InterfaceDeclaration>();

    // Find all type aliases and interfaces
    sourceFile.forEachChild(node => {
      if (ts.isTypeAliasDeclaration(node)) {
        typeAliases.set(node.name.text, node.type);
      } else if (ts.isInterfaceDeclaration(node)) {
        interfaces.set(node.name.text, node);
      }
    });

    // Resolve types
    /*const resolvedType = sourceFile.forEachChild(node => {
      if (ts.isTypeAliasDeclaration(node) && inputType === node.name.text) {
        return this.resolveType(node.type, typeAliases);
      } else if (ts.isInterfaceDeclaration(node) && inputType === node.name.text) {
        return this.resolveInterface(node, typeAliases);
      }
    });

    return resolvedType;*/
    // Iterate through the children of the source file to find and resolve the type
    for (const node of sourceFile.statements) {
      if (ts.isTypeAliasDeclaration(node) && inputType === node.name.text) {
        return this.resolveType(node.type, typeAliases);
      } else if (ts.isInterfaceDeclaration(node) && inputType === node.name.text) {
        return this.resolveInterface(node, typeAliases);
      }
    }
  }


  resolveInterface(
    node: ts.InterfaceDeclaration,
    typeAliases: Map<string, ts.TypeNode>
  ): string {
    // Construct the type definition for the interface
    return `{ ${node.members
      .map(member => this.resolveTypeMember(member, typeAliases))
      .join('; ')} }`;
  }

  resolveType(
    node: ts.TypeNode,
    typeAliases: Map<string, ts.TypeNode>
  ): string {
    if (ts.isTypeReferenceNode(node)) {
      const typeName = node.typeName.getText();
      const aliasNode = typeAliases.get(typeName);

      if (node.typeArguments) {
        const resolvedTypeArgs = node.typeArguments.map(arg => this.resolveType(arg, typeAliases));

        if (aliasNode && ts.isTypeAliasDeclaration(aliasNode)) {
          // Substitute the resolved type arguments into the alias definition
          return this.substituteTypeArguments(aliasNode.type, resolvedTypeArgs, typeAliases);
        }
      }

      const alias = typeAliases.get(node.typeName.getText());
      return alias
        ? this.resolveType(alias, typeAliases)
        : node.typeName.getText();

    } else if (ts.isTypeLiteralNode(node) || ts.isInterfaceDeclaration(node)) {
      // Handle type literal nodes and interface declarations similarly
      const members = ts.isTypeLiteralNode(node) ? node.members : node.members;
      return `{ ${members
        .map(member => this.resolveTypeMember(member, typeAliases))
        .join('; ')} }`;
    } else if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
      return node.types
        .map(type => this.resolveType(type, typeAliases))
        .join(node.kind === ts.SyntaxKind.UnionType ? ' | ' : ' & ');
    }
    return node.getText();
  }

  resolveType2(
    node: ts.TypeNode,
    typeAliases: Map<string, ts.TypeNode>
  ): string {
    if (ts.isTypeReferenceNode(node)) {
      const alias = typeAliases.get(node.typeName.getText());
      return alias
        ? this.resolveType(alias, typeAliases)
        : node.typeName.getText();
    } else if (ts.isTypeLiteralNode(node)) {
      return `{ ${node.members
        .map(member => this.resolveTypeMember(member, typeAliases))
        .join('; ')} }`;
    } else if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
      return node.types
        .map(type => this.resolveType(type, typeAliases))
        .join(node.kind === ts.SyntaxKind.UnionType ? ' | ' : ' & ');
    }
    return node.getText();
  }

  resolveTypeMember(
    member: ts.TypeElement,
    typeAliases: Map<string, ts.TypeNode>,
    typeArgs: string[] = []
  ): string {
    if (ts.isPropertySignature(member)) {
      const name = member.name.getText();
      let type = member.type
        ? this.resolveType(member.type, typeAliases)
        : 'any';
      // Substitute generic type argument if applicable
      if (type === 'T' && typeArgs.length > 0) {
        type = typeArgs[0]; // Assuming 'T' is the first generic type argument
      }

      return `${name}: ${type}`;
    }
    return '';
  }
  findFilesWithPatchFunctions(): SourceFile[] {
    const sourceFilesWithPatchFunctions: Set<SourceFile> = new Set<SourceFile>();
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
  hasPatchFunction2(sourceFile: ts.SourceFile): boolean {
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

  substituteTypeArguments(
    typeNode: ts.TypeNode,
    typeArgs: string[],
    typeAliases: Map<string, ts.TypeNode>
  ): string {
    if (ts.isTypeLiteralNode(typeNode)) {
      return `{ ${typeNode.members
        .map(member => this.resolveTypeMember(member, typeAliases, typeArgs))
        .join('; ')} }`;
    }

    return typeNode.getText();
  }
}

export default PatchFunctionCompiler;
