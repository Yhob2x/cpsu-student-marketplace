import { describe, expect, test } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ApiError, explain } from '../../resources/js/lib/api';
import { ManagedContentAdmin } from '../../resources/js/components/admin/managed-content-admin';

describe('admin content failure isolation', () => {
  test('guidelines and announcements have independent initial loading UI', () => {
    const output = renderToStaticMarkup(React.createElement(ManagedContentAdmin));
    expect(output).toContain('Loading guidelines');
    expect(output).toContain('Loading announcements');
    expect(output).toContain('Editorial content');
  });
  test('missing managed-content migration is actionable instead of internal_error', () => {
    const result = explain(new ApiError(503, 'managed_content_unavailable'));
    expect(result).toContain('approved database migration');
    expect(result).not.toContain('internal_error');
  });
});
