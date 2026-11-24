/** Read-only verification of physical stock and per-listing appreciation after migration. */
import { PrismaClient } from '@prisma/client';
const ledgerRequired=process.argv[2]==='--require-ledger';
if (!['--read-only','--require-ledger'].includes(process.argv[2]||'') || process.argv.length!==3)
  throw Error('STOP: choose --read-only or --require-ledger');
const u = new URL(process.env.DATABASE_URL || 'mysql://invalid');
if(u.hostname!=='127.0.0.1'||u.pathname!=='/cpsu_marketplace'||(!(!u.port||u.port==='3306'))||process.env.NODE_ENV==='production')throw Error('STOP: local dev only');
const prisma = new PrismaClient();
try {
  const tables=await prisma.$queryRawUnsafe<Array<{ TABLE_NAME: string }>>(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('ListingInventory','ListingAppreciation','StoreAppreciation','StudentIdentity','PushOutbox')");
  const names=new Set(tables.map(t=>t.TABLE_NAME.toLowerCase()));
  for (const name of ['ListingInventory','ListingAppreciation','StoreAppreciation'])
    if(!names.has(name.toLowerCase()))throw Error('STOP: '+name+' missing');
  if (names.has('studentidentity') || names.has('pushoutbox')) throw Error('STOP: unrelated migration altered tables');
  const stocks=await prisma.$queryRawUnsafe<Array<{ n: bigint; bad: bigint; held: bigint; missing: bigint }>>(
    `SELECT
      (SELECT COUNT(*) FROM ListingInventory) AS n,
      (SELECT COUNT(*) FROM ListingInventory i LEFT JOIN Listing l ON l.id=i.listingId
         WHERE l.id IS NULL OR l.type<>'physical_product' OR i.availableQuantity<0 OR i.reservedQuantity<0) AS bad,
      (SELECT COALESCE(SUM(reservedQuantity),0) FROM ListingInventory) AS held,
      (SELECT COUNT(*) FROM Listing l LEFT JOIN ListingInventory i ON i.listingId=l.id
         WHERE l.type='physical_product' AND i.listingId IS NULL) AS missing`);
  const stock=stocks[0];
  const count=Number(stock.n);
  if(Number(stock.bad)>0||Number(stock.missing)>0||Number(stock.held)<0)throw Error('STOP: inventory integrity mismatch');
  const expected=await prisma.$queryRawUnsafe<Array<{qty:bigint; held:bigint}>>(
    "SELECT COUNT(*) AS qty, SUM(CASE WHEN reservationTransactionId IS NULL THEN 0 ELSE 1 END) AS held FROM Listing WHERE type='physical_product'");
  if(count!==Number(expected[0]?.qty)||Number(stock.held)!==Number(expected[0]?.held))
    throw Error('STOP: inventory count/reservations mismatched');
  const primary=await prisma.$queryRawUnsafe<Array<{ COLUMN_NAME: string; SEQ_IN_INDEX:bigint }>>(
    "SELECT COLUMN_NAME,SEQ_IN_INDEX FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ListingAppreciation' AND INDEX_NAME='PRIMARY' ORDER BY SEQ_IN_INDEX");
  if(primary.map(x=>x.COLUMN_NAME).join(',')!=='userId,listingId')throw Error('STOP: per-listing uniqueness missing');
  const duplicates=await prisma.$queryRawUnsafe<Array<{bad:bigint}>>(
    'SELECT COUNT(*) AS bad FROM (SELECT userId, listingId FROM ListingAppreciation GROUP BY userId,listingId HAVING COUNT(*)>1) x');
  if(Number(duplicates[0].bad)!==0) throw Error('STOP: duplicate appreciations');
  if(ledgerRequired) {
    const log=await prisma.$queryRawUnsafe<Array<{finished_at:Date|null;rolled_back_at:Date|null}>>(
      "SELECT finished_at,rolled_back_at FROM _prisma_migrations WHERE migration_name='20261123164500_listing_stock_and_appreciations' LIMIT 1");
    if(!log.length||!log[0].finished_at||log[0].rolled_back_at)throw Error('STOP: target migration not in applied ledger');
  }
  console.log('STOCK_APPRECIATION_ACTIVATION_VERIFIED; product_inventory='+count+
    '; reserved='+Number(stock.held)+'; missing=0; service_inventory=0; composite_unique=yes'+
    '; identity_push_tables=absent; ledger_required='+ledgerRequired);
} finally { await prisma.$disconnect(); }
