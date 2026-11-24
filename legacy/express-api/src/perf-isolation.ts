/** Guards for the separate, loopback-only synthetic performance API entrypoint.
 * These functions are pure until verifyPerfDatabase calls injected readers.
 * The ordinary development/production entrypoint does NOT use this module.
 */
type Env = Record<string, string | undefined>;
// Never accept generic integration-test or staging DBs for capacity traffic.
const DB_NAME = /^cpsu_marketplace_perf$/;

export function validatePerfApiEnvironment(env: Env) {
  if (env.PERF_ISOLATED !== 'I_CONFIRM_SYNTHETIC_ONLY' ||
      env.PERF_DB_VERIFIED !== 'I_CHECKED_API_DATABASE_TARGET')
    throw new Error('Synthetic-only API declarations are required');
  if (!DB_NAME.test(env.PERF_DB_NAME ?? ''))
    throw new Error('An allowlisted synthetic database name is required');
  if (env.NODE_ENV !== 'production' || env.BIND_HOST !== '127.0.0.1' ||
      env.PORT !== '4401' || env.COOKIE_SECURE !== 'true')
    throw new Error('Performance API requires production-like controls on 127.0.0.1:4401');
  if (env.PUSH_SUBSCRIPTIONS_ENABLED !== 'false' ||
      env.PUSH_DELIVERY_ENABLED !== 'false' ||
      env.STUDENT_ID_COLLECTION_ENABLED !== 'false' || env.MEDIA_STORAGE !== 'local')
    throw new Error('External delivery and identity collection must be explicitly disabled');
  const uploadPath = (env.UPLOAD_DIR ?? '').replace(/\\/g, '/');
  if (!/^(?:[A-Za-z]:\/|\/)/.test(uploadPath) ||
      !/(?:^|\/)\.tmp\/perf-uploads(?:\/|$)/i.test(uploadPath) ||
      uploadPath.split('/').includes('..'))
    throw new Error('A dedicated absolute .tmp/perf-uploads directory is required');
  if (!env.PERF_TARGET_TOKEN || env.PERF_TARGET_TOKEN.length < 32 ||
      env.PERF_TARGET_TOKEN.length > 512)
    throw new Error('A separate high-entropy performance probe token is required');
  const origins = (env.CORS_ORIGINS ?? '').split(',').map(x => x.trim());
  if (!origins.length || origins.some(origin => !/^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(origin)))
    throw new Error('Local performance API CORS origins must be loopback-only');

  let parsed: URL;
  try { parsed = new URL(env.DATABASE_URL ?? ''); }
  catch { throw new Error('Missing or invalid synthetic database URL'); }
  if (parsed.protocol !== 'mysql:' || !['127.0.0.1', 'localhost'].includes(parsed.hostname) ||
      !parsed.username || !parsed.password || parsed.search || parsed.hash ||
      parsed.pathname !== `/${env.PERF_DB_NAME}`)
    throw new Error('Database URL must target only the declared loopback synthetic database');
  return { dbName: env.PERF_DB_NAME!, port: 4401, bindHost: '127.0.0.1' as const };
}

/** The database must report its own schema name, and never contain real-user emails.
 * Only aggregate counts are inspected. No accounts, passwords or messages are read.
 */
export async function verifyPerfDatabase(
  expectedName: string,
  getSelectedSchema: () => Promise<string | null>,
  countNonSyntheticUsers: () => Promise<number>,
) {
  if (!DB_NAME.test(expectedName)) throw new Error('Unapproved performance database name');
  const actual = await getSelectedSchema();
  if (actual !== expectedName) throw new Error('Connected database does not match isolated target');
  const nonSynthetic = await countNonSyntheticUsers();
  if (!Number.isSafeInteger(nonSynthetic) || nonSynthetic < 0 || nonSynthetic > 0)
    throw new Error('Isolated database has unverified or non-synthetic accounts');
  return { database: expectedName, isolated: true as const };
}
