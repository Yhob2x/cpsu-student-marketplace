/**
 * Additive StoreReview migration smoke test against a brand-new disposable
 * local MariaDB database. Never connects to or mutates the CPSU source schema.
 * Run from apps/api: bun scripts/store-reviews-synthetic-ddl.ts --synthetic-only
 */
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const fail = (message: string): never => { throw new Error('REFUSED: ' + message); };
if (process.argv.length !== 3 || process.argv[2] !== '--synthetic-only') fail('explicit --synthetic-only required');
if (process.env.NODE_ENV === 'production') fail('production forbidden');
const raw = process.env.DATABASE_URL;
if (!raw) fail('missing DATABASE_URL');
const u = new URL(raw);
if (u.protocol !== 'mysql:' || u.hostname !== '127.0.0.1' ||
  (u.port && u.port !== '3306') || decodeURIComponent(u.pathname.slice(1)) !== 'cpsu_marketplace')
  fail('expected local 127.0.0.1:3306/cpsu_marketplace credential source');
const executable = 'C:\\xampp\\mysql\\bin\\mysql.exe';
const name = 'cpsu_reviews_qa_' + randomBytes(6).toString('hex');
const migration = readFileSync(resolve(import.meta.dir, '../prisma/migrations/20261118160000_store_reviews/migration.sql'), 'utf8');
if (!migration.includes('CREATE TABLE `StoreReview` (') ||
  !migration.includes('StoreReview_transactionId_key') || !migration.includes('StoreReview_rating_range_chk'))
  fail('the staged review migration is not the expected additive SQL');

const baseArgs = ['--protocol=TCP','--host=127.0.0.1','--port=3306',
  '--user=' + decodeURIComponent(u.username), '--batch', '--skip-column-names'];
const env = { ...process.env, MYSQL_PWD: decodeURIComponent(u.password) };
function mysql(sql: string, database?: string, expectFailure = false): string {
  const result = spawnSync(executable, [...baseArgs, ...(database ? ['--database=' + database] : [])], {
    env, input: sql, encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 512, windowsHide: true,
  });
  if (result.error) fail('local MariaDB executable unavailable');
  if (expectFailure) {
    if (result.status === 0) fail('negative database constraint test unexpectedly succeeded');
    return '';
  }
  if (result.status !== 0) fail('isolated SQL test failed (exit ' + result.status + '); no database credentials shown');
  return result.stdout.trim();
}
let created = false;
let success = false;
try {
  mysql('CREATE DATABASE `' + name + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
  created = true;
  mysql([
    'CREATE TABLE `User` (`id` INTEGER NOT NULL PRIMARY KEY);',
    'CREATE TABLE `SellerProfile` (`id` INTEGER NOT NULL PRIMARY KEY);',
    'CREATE TABLE `Transaction` (`id` INTEGER NOT NULL PRIMARY KEY);',
    'INSERT INTO `User` VALUES (11);',
    'INSERT INTO `SellerProfile` VALUES (2);',
    'INSERT INTO `Transaction` VALUES (31),(32);',
  ].join('\n'), name);
  mysql(migration, name);
  mysql('INSERT INTO `StoreReview` (`transactionId`,`sellerProfileId`,`buyerUserId`,`rating`) VALUES (31,2,11,5);', name);
  const first = mysql('SELECT `status`,`rating` FROM `StoreReview` WHERE `transactionId`=31;', name);
  if (first !== 'pending\t5') fail('pending rating row did not persist');
  mysql('INSERT INTO `StoreReview` (`transactionId`,`sellerProfileId`,`buyerUserId`,`rating`) VALUES (31,2,11,4);', name, true);
  mysql('INSERT INTO `StoreReview` (`transactionId`,`sellerProfileId`,`buyerUserId`,`rating`) VALUES (32,2,11,6);', name, true);
  mysql('INSERT INTO `StoreReview` (`transactionId`,`sellerProfileId`,`buyerUserId`,`rating`) VALUES (32,2000,11,4);', name, true);
  mysql('DELETE FROM `SellerProfile` WHERE `id`=2;', name, true);
  const count = mysql('SELECT COUNT(*) FROM `StoreReview`;', name);
  if (count !== '1') fail('negative tests modified stored reviews');
  success = true;
  console.log('STORE_REVIEW_ISOLATED_DDL_PASS unique_transaction=PASS rating_range=PASS foreign_key=PASS delete_restrict=PASS defaults=PASS');
} finally {
  if (created) {
    try {
      mysql('DROP DATABASE `' + name + '`;');
      console.log('STORE_REVIEW_ISOLATED_CLEANUP_PASS disposable_database_removed=true');
    } catch {
      console.error('CLEANUP_FAILED: disposable test schema retained: ' + name);
      process.exitCode = 1;
    }
  }
}
if (!success) process.exitCode = 1;
