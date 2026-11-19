import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { Panel, Field } from '../src/components/ui/primitives';

describe('shared CPSU Market native wrappers', () => {
  test('Panel preserves native sections, class hooks and accessible names', () => {
    const html = renderToStaticMarkup(
      <Panel as="section" className="stack" aria-labelledby="guideline-editor-title">
        <h3 id="guideline-editor-title">Marketplace guidelines</h3>
      </Panel>);
    expect(html).toContain('<section ');
    expect(html).toContain('class="panel stack"');
    expect(html).toContain('aria-labelledby="guideline-editor-title"');
    expect(html).toContain('</section>');
  });

  test('Field keeps label association, native input constraints and custom classes', () => {
    const html = renderToStaticMarkup(
      <Field className="moderation-reason">Reason
        <input type="text" required minLength={5} maxLength={100} />
      </Field>);
    expect(html).toContain('<label class="field moderation-reason">');
    expect(html).toContain('required=""');
    expect(html).toContain('minLength="5"');
    expect(html).toContain('maxLength="100"');
    expect(html).toContain('</label>');
  });

  test('public crawler policy is plain text and avoids private workflow paths', () => {
    const robots = readFileSync(new URL('../public/robots.txt', import.meta.url), 'utf8');
    expect(robots.startsWith('User-agent: *')).toBe(true);
    expect(robots).toContain('Allow: /');
    for (const path of ['/admin','/dashboard','/inquiries','/transactions','/api/']) {
      expect(robots).toContain('Disallow: ' + path);
    }
    expect(robots).not.toContain('<html');
  });

  test('student and admin screens reuse native Field and Panel without recreating HTML roles', () => {
    for (const [filename, fields, panels] of [
      ['pages-admin.tsx', 11, 6],
      ['pages-account.tsx', 26, 5],
      ['pages-profile.tsx', 1, 4],
    ] as const) {
      const source = readFileSync(new URL('../src/' + filename, import.meta.url), 'utf8');
      expect((source.match(/<Field(?:\s|>)/g) ?? []).length).toBe(fields);
      expect((source.match(/<Panel(?:\s|>)/g) ?? []).length).toBe(panels);
      expect(source).toContain("from './components/ui/primitives'");
    }
  });

  test('migration retains the previous admin field markup contract', () => {
    for (const target of ['pages-managed-content.tsx','pages-reviewers.tsx','pages-catalog-admin.tsx']) {
      const source = readFileSync(new URL('../src/'+target,import.meta.url),'utf8');
      expect(source).toContain("import { Field");
      expect(source).toContain('<Field>');
      expect(source).not.toContain('<label className="field">');
    }
  });
});
