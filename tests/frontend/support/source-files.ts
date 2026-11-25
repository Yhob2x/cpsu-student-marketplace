import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SOURCE_ROOT = fileURLToPath(new URL('../../../resources/js/', import.meta.url));

/** Reads one or more files under resources/js and joins them, for source-contract assertions. */
export function readSource(...files: string[]): string {
  return files.map(file => readFileSync(join(SOURCE_ROOT, file), 'utf8')).join('\n');
}

/** Every .tsx/.ts file under resources/js, as paths relative to it. */
export function sourceFiles(extension = '.tsx'): string[] {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith(extension) ? [relative(SOURCE_ROOT, full).replaceAll('\\', '/')] : [];
  });
  return walk(SOURCE_ROOT);
}

/** Files that hold the code of the former single-file page modules. */
export const PAGE_GROUPS = {
  account: ['pages/auth/login.tsx', 'pages/auth/register.tsx', 'pages/dashboard.tsx', 'pages/inquiries/index.tsx', 'pages/inquiries/show.tsx', 'pages/saved.tsx', 'components/chat/message-receipt.tsx'],
  public: ['components/listings/listing-card.tsx', 'pages/home.tsx', 'pages/explore.tsx', 'pages/listings/show.tsx', 'pages/stores/show.tsx', 'pages/guidelines.tsx'],
  profile: ['pages/profile.tsx', 'pages/notifications.tsx', 'lib/account/notifications.ts'],
  transactions: ['pages/transactions/index.tsx', 'pages/transactions/show.tsx', 'components/transactions/status-pill.tsx'],
  shell: ['layouts/app-layout.tsx', 'components/layout/account-menu.tsx', 'routes.tsx', 'providers/session-provider.tsx'],
} as const;
