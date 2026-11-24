import { PrismaClient } from '@prisma/client';
const url = new URL(process.env.DATABASE_URL ?? '');
if (process.env.NODE_ENV === 'production' ||
  !['localhost','127.0.0.1','::1'].includes(url.hostname) ||
  decodeURIComponent(url.pathname.slice(1)) !== 'cpsu_marketplace') {
  throw new Error('Local CPSU development database only.');
}
const db = new PrismaClient();
try {
  const rows = await db.$queryRawUnsafe<Array<{ legacy: string; state: string; total: bigint }>>(
    'SELECT availability AS legacy, availabilityState AS state, COUNT(*) AS total FROM Listing GROUP BY availability, availabilityState'
  );
  console.log('WP2 availability distribution (aggregated, no listing data):');
  for (const r of rows) console.log(r.legacy + ' / ' + r.state + ': ' + String(r.total));
  const nullable = await db.$queryRawUnsafe<Array<{ n: bigint }>>(
    "SELECT COUNT(*) AS n FROM Listing WHERE type = 'physical_product' AND " + String.fromCharCode(96) + "condition" + String.fromCharCode(96) + " IS NULL"
  );
  console.log('Legacy products needing condition for resubmission: ' + String(nullable[0]?.n ?? 0));
} finally { await db.$disconnect(); }
