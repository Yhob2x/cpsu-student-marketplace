/**
 * Non-production, schema-only acceptance of the listing stock + appreciation migration.
 * Never backs up, reads, or restores private student rows.
 * Creates a randomly named disposable MariaDB schema, inserts only synthetic rows,
 * applies only the named migration there, asserts backfill/uniqueness and drops
 * only the disposable schema in finally.
 * Run from apps/api: bun scripts/listing-stock-isolated-rehearsal.ts --isolated-rehearsal
 */
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const pass = (ok: unknown, why: string): asserts ok => { if (!ok) throw Error('STOP: ' + why); };
pass(process.argv.length === 3 && process.argv[2] === '--isolated-rehearsal',
  'Explicit --isolated-rehearsal required.');
pass(process.env.NODE_ENV !== 'production', 'Production is forbidden.');
const source = process.env.DATABASE_URL;
pass(source, 'DATABASE_URL missing');
const url = new URL(source);
pass(url.protocol === 'mysql:' && url.hostname === '127.0.0.1' &&
  (!url.port || url.port === '3306') && url.pathname === '/cpsu_marketplace' &&
  !url.search && !url.hash, 'Only local CPSU development database may be used as schema source');
const mysql = 'C:\\xampp\\mysql\\bin\\mysql.exe';
const mysqldump = 'C:\\xampp\\mysql\\bin\\mysqldump.exe';
pass(existsSync(mysql) && existsSync(mysqldump), 'XAMPP MariaDB CLIs unavailable');
const migrationPath = resolve(import.meta.dir, '../prisma/migrations/20261123164500_listing_stock_and_appreciations/migration.sql');
const migration = readFileSync(migrationPath, 'utf8');
pass(migration.includes('CREATE TABLE `ListingInventory`') && migration.includes('CREATE TABLE `ListingAppreciation`'),
  'Unexpected stock/appreciation migration');
const target = 'cpsu_stock_rehearsal_' + randomBytes(8).toString('hex');
const secretEnv = { ...process.env, MYSQL_PWD: decodeURIComponent(url.password) };
const args = ['--protocol=TCP', '--host=127.0.0.1', '--port=3306',
  '--user=' + decodeURIComponent(url.username)];
function sql(script: string, database?: string): string {
  const result = spawnSync(mysql, [...args, ...(database ? ['--database=' + database] : [])], {
    input: script, env: secretEnv, encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0 || result.error) throw Error('Isolated SQL failed (exit=' + result.status +
    '): ' + String(result.stderr || result.error).replace(/Access denied.*/s, 'Access denied'));
  return result.stdout.trim();
}
let created = false;
try {
  const sourceDatabase = sql('SELECT DATABASE();', 'cpsu_marketplace');
  pass(sourceDatabase.split(/\r?\n/).at(-1) === 'cpsu_marketplace', 'Unexpected source identity');
  sql('CREATE DATABASE `' + target + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
  created = true;
  const snapshot = spawnSync(mysqldump, [...args, '--no-data', '--single-transaction',
    '--skip-add-drop-table', '--no-tablespaces', '--skip-triggers', '--default-character-set=utf8mb4',
    'cpsu_marketplace'], { env: secretEnv, encoding: 'utf8', windowsHide: true,
      timeout: 120000, maxBuffer: 24 * 1024 * 1024 });
  pass(snapshot.status === 0 && !snapshot.error && snapshot.stdout.includes('CREATE TABLE'),
    'Schema-only dump failed');
  pass(!/^INSERT INTO |^REPLACE INTO /m.test(snapshot.stdout), 'Dump unexpectedly contains student data');
  sql(snapshot.stdout, target);
  console.log('SCHEMA_ONLY_RESTORED: no private source rows copied');
  // Synthetic rows cover available, sold, manual hold, and service states.
  sql(`
    INSERT INTO Campus (id,code,name,active) VALUES (101,'QA_STOCK','Synthetic QA campus',1);
    INSERT INTO Category (id,name,listingType,policyRiskLevel)
    VALUES (101,'QA Product','physical_product',0),(102,'QA Service','service',0);
    INSERT INTO User (id,email,displayName,passwordHash,status)
    VALUES (101,'seller@synthetic.invalid','QA Seller','not-real','active'),
      (102,'buyer@synthetic.invalid','QA Buyer','not-real','active');
    INSERT INTO SellerProfile (id,ownerUserId,campusId,storeName,description,sellerType,approvalStatus)
    VALUES (101,101,101,'Synthetic Seller','Test-only fake account','student','approved');
    INSERT INTO Listing (id,sellerProfileId,campusId,categoryId,type,title,description,price,
      availability,availabilityState,\`condition\`,status)
    VALUES (101,101,101,101,'physical_product','Available QA product','Synthetic item for stock rehearsal',75,'available','available','new','published'),
      (102,101,101,101,'physical_product','Sold QA product','Synthetic sold item for rehearsal',75,'sold','sold','new','published'),
      (103,101,101,101,'physical_product','Manually reserved','Synthetic held item for rehearsal',75,'reserved','reserved','new','published'),
      (104,101,101,102,'service','Synthetic tutoring','Synthetic service listing only',50,'available','available',NULL,'published');
  `, target);
  sql(migration, target);
  const results = sql('SELECT listingId,availableQuantity,reservedQuantity FROM ListingInventory ORDER BY listingId;', target);
  pass(results.includes('101\t1\t0') && results.includes('102\t0\t0') &&
    results.includes('103\t1\t0') && !results.includes('104\t'),
    'Stock migration backfill changed existing listing semantics');
  sql('INSERT INTO ListingAppreciation (userId, listingId) VALUES (102,101), (102,102);', target);
  const likes = sql('SELECT COUNT(*) AS n FROM ListingAppreciation WHERE userId=102;', target);
  pass(likes.split(/\r?\n/).at(-1) === '2', 'One student could not appreciate different products');
  let duplicateBlocked = false;
  try { sql('INSERT INTO ListingAppreciation (userId, listingId) VALUES (102,101);', target); }
  catch { duplicateBlocked = true; }
  pass(duplicateBlocked, 'Duplicate appreciation was not rejected');
  sql('UPDATE ListingInventory SET availableQuantity=availableQuantity-1, reservedQuantity=reservedQuantity+1 WHERE listingId=101 AND availableQuantity>0;', target);
  sql('UPDATE ListingInventory SET availableQuantity=availableQuantity-1, reservedQuantity=reservedQuantity+1 WHERE listingId=101 AND availableQuantity>0;', target);
  pass(sql('SELECT availableQuantity,reservedQuantity FROM ListingInventory WHERE listingId=101;', target).includes('0\t1'),
    'More than one unit reserved from stock of 1');
  sql('UPDATE ListingInventory SET availableQuantity=availableQuantity+1, reservedQuantity=reservedQuantity-1 WHERE listingId=101 AND reservedQuantity>0;', target);
  pass(sql('SELECT availableQuantity,reservedQuantity FROM ListingInventory WHERE listingId=101;', target).includes('1\t0'),
    'Cancelled reservation did not restore stock');
  console.log('PASS: migration/backfill, service isolation, one-per-listing, duplicate defense, reserve/release');
} finally {
  if (created) {
    sql('DROP DATABASE `' + target + '`;');
    console.log('SCRATCH_SCHEMA_CLEANED: ' + target);
  }
}
