import * as ts from 'typescript';
import { Tanuki } from "./tanuki";

module.exports = function tanukiTransformer(program: ts.Program): ts.TransformerFactory<ts.SourceFile> {
  // Instantiate Tanuki
  console.log("Instantiating Tanuki")
  const tanuki = new Tanuki();

  return (context: ts.TransformationContext) => {

    return (file: ts.SourceFile) => {
      const visitor: ts.Visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
        // Transformer logic here
        return ts.visitEachChild(node, visitor, context);
      };

      return ts.visitNode(file, visitor);
    };
  };
}