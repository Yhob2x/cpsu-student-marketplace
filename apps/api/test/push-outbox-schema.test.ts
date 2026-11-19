import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const schema = readFileSync(resolve(import.meta.dir, '../prisma/schema.prisma'), 'utf8');
const migration = readFileSync(resolve(import.meta.dir,
  '../prisma/migrations/20261119150000_push_delivery_outbox/migration.sql'), 'utf8');

describe('staged durable Web Push migration contract; static read-only', () => {
  it('creates queue, per-device idempotency, per-user daily budgets and aggregate metrics', () => {
    for (const name of ['PushOutbox', 'PushAttempt', 'PushDailyBudget', 'PushDailyMetric']) {
      expect(schema).toContain(`model ${name} {`);
      expect(migration).toContain(`CREATE TABLE \`${name}\``);
    }
    expect(migration).toContain('PushOutbox_notificationId_key');
    expect(migration).toContain('PushAttempt_outboxId_endpointHash_key');
    expect(migration).toContain('PRIMARY KEY (`userId`, `dayKey`)');
    expect(migration).toContain('`budgetReservedAt` DATETIME(3) NULL');
    expect(schema).toContain('budgetReservedAt DateTime?');
    expect(migration).toContain('PushOutbox_state_nextAttemptAt_idx');
    expect(migration).toContain('PushOutbox_state_leasedUntil_idx');
  });

  it('uses the canonical notification FK and never copies private payload into the queue', () => {
    expect(schema).toContain('notificationId Int       @unique');
    expect(migration).toContain('REFERENCES `Notification`(`id`)');
    expect(migration).toContain('REFERENCES `User`(`id`)');
    const outboxSql = migration.split('CREATE TABLE `PushOutbox` (')[1]?.split('CREATE TABLE `PushAttempt`')[0];
    expect(outboxSql).toBeDefined();
    for (const forbidden of ['body', 'messageText', 'senderName', 'endpoint`', 'p256dh', 'auth`', 'secret']) {
      expect(outboxSql).not.toContain(forbidden);
    }
    expect(migration).toContain('endpointHash` CHAR(64)');
  });

  it('is additive and has no existing-student data deletion or automatic activation', () => {
    expect(migration).toMatch(/^-- STAGED ONLY:/);
    // ON DELETE CASCADE is a foreign-key policy, not an executable DELETE statement.
    expect(migration).not.toMatch(/^\s*(?:DROP\s|TRUNCATE\s|DELETE\s+FROM\s|REPLACE\s+INTO\s|UPDATE\s+`?User`?\s)/im);
    expect(migration).toContain('ALTER TABLE `PushPreference`');
    expect(migration).toContain('ADD COLUMN `masterEnabled` BOOLEAN NOT NULL DEFAULT true');
    expect(migration).toContain('ADD COLUMN `quietStartMinute` INTEGER NULL');
    expect(migration).toContain('ADD COLUMN `quietEndMinute` INTEGER NULL');
    // Privacy: never generate permission grants or enable delivery flags in migrations.
    expect(migration).not.toMatch(/\b(?:GRANT|PUSH_DELIVERY_ENABLED|PUSH_SUBSCRIPTIONS_ENABLED)\b/);
  });

  it('prevents storing capability URLs in the attempt ledger', () => {
    const attempts = schema.split('model PushAttempt {')[1]?.split('\n}')[0];
    expect(attempts).toBeDefined();
    expect(attempts).toContain('endpointHash');
    expect(attempts).not.toMatch(/^\s*endpoint\s+/m);
    expect(attempts).not.toMatch(/^\s*(?:body|payload|p256dh|auth)\s+/m);
  });
});
