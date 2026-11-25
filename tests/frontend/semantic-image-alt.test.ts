import { expect, test } from 'bun:test';
import * as ts from 'typescript';
import { readSource, sourceFiles } from './support/source-files';

test('every native marketplace image declares alt text or an intentional decorative alt', () => {
  const missing: string[] = [];
  let count = 0;

  for (const filename of sourceFiles('.tsx')) {
    const source = readSource(filename);
    const parsed = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const inspect = (node: ts.Node) => {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
          node.tagName.getText(parsed) === 'img') {
        count++;
        const accessible = node.attributes.properties.some(attribute =>
          ts.isJsxAttribute(attribute) && attribute.name.getText(parsed) === 'alt');
        if (!accessible) {
          const { line } = parsed.getLineAndCharacterOfPosition(node.getStart(parsed));
          missing.push(filename + ':' + (line + 1));
        }
      }
      ts.forEachChild(node, inspect);
    };
    inspect(parsed);
  }

  expect(count).toBeGreaterThan(0);
  expect(missing).toEqual([]);
});
