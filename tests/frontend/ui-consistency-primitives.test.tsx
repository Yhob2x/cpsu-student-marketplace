import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { PAGE_GROUPS, readSource } from './support/source-files';
import { renderToStaticMarkup } from 'react-dom/server';
import { Panel, Field } from '../../resources/js/components/ui/primitives';

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
    const robots = readFileSync(new URL('../../public/robots.txt', import.meta.url), 'utf8');
    expect(robots.startsWith('User-agent: *')).toBe(true);
    expect(robots).toContain('Allow: /');
    for (const path of ['/admin','/dashboard','/inquiries','/transactions','/api/']) {
      expect(robots).toContain('Disallow: ' + path);
    }
    expect(robots).not.toContain('<html');
  });

  test('student and admin screens reuse native Field and Panel without recreating HTML roles', () => {
    for (const [filename, fields, panels] of [
      [['pages/admin/index.tsx'], 11, 5],
      [['components/admin/university-dashboard.tsx'], 0, 6],
      [PAGE_GROUPS.account, 28, 5],
      [PAGE_GROUPS.profile, 1, 4],
      [PAGE_GROUPS.public, 3, 4],
      [PAGE_GROUPS.transactions, 1, 5],
    ] as const) {
      const source = readSource(...filename);
      expect((source.match(/<Field(?:\s|>)/g) ?? []).length).toBe(fields);
      expect((source.match(/<Panel(?:\s|>)/g) ?? []).length).toBe(panels);
      expect(source).toContain("from '@/components/ui/primitives'");
    }
  });

  test('migration retains the previous admin field markup contract', () => {
    for (const target of ['components/admin/managed-content-admin.tsx','components/admin/reviewer-admin.tsx','components/admin/catalog-admin.tsx']) {
      const source = readSource(target);
      expect(source).toContain("import { Field");
      expect(source).toContain('<Field>');
      expect(source).not.toContain('<label className="field">');
    }
  });
});
