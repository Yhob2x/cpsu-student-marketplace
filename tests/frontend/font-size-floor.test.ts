import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

test('authored CSS does not shrink legible text below the 12px system floor', () => {
  const root = fileURLToPath(new URL('../../resources/css/', import.meta.url));
  const problems: string[] = [];
  function inspect(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) { inspect(full); continue; }
      if (!entry.isFile() || !entry.name.endsWith('.css')) continue;
      const css = postcss.parse(readFileSync(full, 'utf8'), { from: full });
      css.walkDecls('font-size', decl => {
        for (const match of decl.value.matchAll(/(-?\d*\.?\d+)(px|rem)\b/g)) {
          const px = Number(match[1]) * (match[2] === 'rem' ? 16 : 1);
          // Zero is an intentional decorative/icon reset; negative values are invalid here.
          if (px > 0 && px < 12) {
            problems.push(entry.name + ':' + decl.source?.start?.line + ' ' + decl.parent?.toString().slice(0, 60));
          }
        }
      });
    }
  }
  inspect(root);
  expect(problems).toEqual([]);
});
