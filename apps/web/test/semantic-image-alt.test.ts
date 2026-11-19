import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';

test('every native marketplace image declares alt text or an intentional decorative alt', () => {
  const srcDirectory = fileURLToPath(new URL('../src/', import.meta.url));
  const missing: string[] = [];
  let count = 0;

  for (const filename of readdirSync(srcDirectory).filter(name => name.endsWith('.tsx'))) {
    const source = readFileSync(new URL('../src/' + filename, import.meta.url), 'utf8');
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
