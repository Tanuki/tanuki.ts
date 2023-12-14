import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";

interface Assertion {
  args: string; // or a more specific type if possible
}

interface Mock {
  [key: string]: any; // Replace 'any' with a more specific type if possible
}

const ASSERTIONS_FILEPATH = '/Users/jackhopkins/WebstormProjects/tanuki.ts/lib/src/assertions';

class AssertionCompiler {
  directoryToSearch: string;
  constructor(directoryToSearch: string) {
    this.directoryToSearch = directoryToSearch;
  }
  compile(): any {
    const filesWithDecorator = this.findFilesWithAlignDecorator(this.directoryToSearch);
    filesWithDecorator.forEach(file => {
      this.logAssertsInFileWithDecorator(file);
    });
  }
  mocks(): Array<Record<string, string>> {
    const assertionModule = require(ASSERTIONS_FILEPATH) as { assertions: Assertion[] };
    if (!assertionModule.assertions) {
      throw new Error("No assertions found.");
    }
    const assertions = assertionModule.assertions;
    const mocks: Record<string, any>[] = [];
    for (const assertion of assertions) {
      const mock: Record<string, any> = {};
      const args = assertion.args.split(', ');
      for (const arg of args) {
        const [key, value] = arg.split(': ');
        mock[key] = value;
      }
      mocks.push(mock);
    }
    return mocks;
  }
  findFilesWithAlignDecorator(directory: string): string[] {
    let filesWithDecorator: string[] = [];
    const files = fs.readdirSync(directory);
    for (const file of files) {
      const fullPath = path.join(directory, file);
      if (fs.statSync(fullPath).isDirectory()) {
        filesWithDecorator = filesWithDecorator.concat(this.findFilesWithAlignDecorator(fullPath));
      } else if (file.endsWith(".ts")) {
        const fileContent = ts.sys.readFile(fullPath);
        if (fileContent && this.hasAlignDecorator(fileContent)) {
          filesWithDecorator.push(fullPath);
        }
      }
    }
    return filesWithDecorator;
  }

  hasAlignDecorator(fileContent: string): boolean {
    const sourceFile = ts.createSourceFile(
      "tempFile.ts", // Filename is not relevant for analysis
      fileContent,
      ts.ScriptTarget.Latest
    );

    let hasDecorator = false;
    ts.forEachChild(sourceFile, node => {
      if (ts.isClassDeclaration(node) && node.members) {
        for (const member of node.members) {
          if (ts.isMethodDeclaration(member) && member.decorators) {
            for (const decorator of member.decorators) {
              if (ts.isIdentifier(decorator.expression) && decorator.expression.escapedText === 'align') {
                hasDecorator = true;
                return;
              } else if (ts.isCallExpression(decorator.expression)) {
                const decoratorIdentifier = decorator.expression.expression;
                if (ts.isIdentifier(decoratorIdentifier) && decoratorIdentifier.escapedText === 'align') {
                  hasDecorator = true;
                  return;
                }
              }
            }
          }
        }
      }
    });
    return hasDecorator;
  }
  logAssertsInFileWithDecorator(fileName: string) {
    const fileContent = ts.sys.readFile(fileName);
    if (!fileContent) {
      console.log("File not found.");
      return;
    }
    const sourceFile = ts.createSourceFile(
      fileName,
      fileContent,
      ts.ScriptTarget.Latest
    );

    function findMethod(node: ts.Node) {
      if (ts.isClassDeclaration(node) && node.members) {
        for (const member of node.members) {
          if (ts.isMethodDeclaration(member) && member.decorators) {
            for (const decorator of member.decorators) {
              if (ts.isIdentifier(decorator.expression) && decorator.expression.escapedText === 'align') {
                ts.forEachChild(member, findAssertCalls);
              } else
              if (ts.isCallExpression(decorator.expression)) {
                const decoratorIdentifier = decorator.expression.expression;
                if (ts.isIdentifier(decoratorIdentifier) && decoratorIdentifier.escapedText === 'align') {
                  ts.forEachChild(member, findAssertCalls);
                }
              }
            }
          }
        }
      }
      ts.forEachChild(node, findMethod);
    }

    const assertions: Record<string, string>[] = []
    function findAssertCalls(node: ts.Node) {
      // Check if it's an expression statement
      if (ts.isExpressionStatement(node)) {
        // Check if it's a call expression
        const expression = node.expression;
        if (ts.isCallExpression(expression)) {
          // Check if the function being called is 'assert'
          const expressionIdentifier = expression.expression;
          if (expressionIdentifier && ts.isIdentifier(expressionIdentifier) && expressionIdentifier.escapedText === 'assert') {
            // Extract the arguments of the assert call
            const args = expression.arguments.map(arg => arg.getText(sourceFile));
            assertions.push({ file: fileName, args: args.join(', ') });
            console.log(`Assert called with arguments: ${args.join(', ')}`);
          }
        }
      }
      ts.forEachChild(node, findAssertCalls);
    }

    findMethod(sourceFile);

    // Write to a JavaScript file
    const jsContent = `exports.assertions = ${JSON.stringify(assertions, null, 2)};`;
    fs.writeFileSync(ASSERTIONS_FILEPATH+'.js', jsContent);

  // Write a TypeScript declaration file
    const dTsContent = `export declare const assertions: { file: string; args: string; }[];`;
    fs.writeFileSync(ASSERTIONS_FILEPATH+'.d.ts', dTsContent);
  }
}

export default AssertionCompiler;