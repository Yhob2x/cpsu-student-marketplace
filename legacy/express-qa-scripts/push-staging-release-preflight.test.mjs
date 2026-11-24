import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  realPublicHost, stagingOriginValid, contactValid, evaluateReleaseProfile,
} from './push-staging-release-preflight.mjs';

const migrations = ['init_migration', 'push_notifications', 'wp3_concurrent'];
const baseline = () => ({
  stagingOrigin: 'https://staging.cpsu.edu.ph',
  vapidContact: 'mailto:push-support@cpsu.edu.ph',
  stagingDatabase: 'cpsu_marketplace_staging',
  hostingOwner: 'CPSU staging operations',
  deploymentApprover: 'Designated CPSU staging reviewer',
  deploymentApprovalReference: 'CPSU-TEST-APPROVAL-2026',
  privacyApprovalReference: 'CPSU-PRIVACY-TEST-2026',
  trustedHttpsVerified: true,
  hostingPermissionConfirmed: true,
  dedicatedHostAndDatabaseConfirmed: true,
  syntheticTestAccountsOnly: true,
  backupAndRestorePlanApproved: true,
  approvedMigrations: migrations.slice(),
  pushSubscriptionsEnabled: false,
  pushDeliveryEnabled: false,
});
const context = { migrations, sourceClean: true, builtSafe: true, templatesSafe: true };
const issues = (profile, contextOverrides = {}) =>
  evaluateReleaseProfile(profile, { ...context, ...contextOverrides })
    .filter(check => !check.ok).map(check => check.label);

describe('Stage 6 staging release preflight — offline only', () => {
  test('rejects placeholders, localhost, insecure origins, reserved domains and URLs with credentials', () => {
    for (const origin of [
      'https://__STAGING_DOMAIN__', 'http://staging.cpsu.edu.ph',
      'https://localhost:8443', 'https://staging.example.com',
      'https://user:pass@cpsu.edu.ph', 'https://127.0.0.1',
      'https://cpsu.edu.ph/path', 'https://cpsu.edu.ph:444',
    ]) assert.equal(stagingOriginValid(origin), false);
    assert.equal(stagingOriginValid('https://staging.cpsu.edu.ph'), true);
    assert.equal(realPublicHost('staging.cpsu.edu.ph'), true);
    assert.equal(realPublicHost('example.invalid'), false);
  });

  test('rejects test or unmonitored-looking VAPID contacts by syntax', () => {
    for (const candidate of [
      'mailto:__APPROVED_MONITORED_CONTACT_EMAIL__',
      'mailto:push@example.invalid', 'https://localhost:8443/',
      'https://push.example.com/help', 'http://support.cpsu.edu.ph',
    ]) assert.equal(contactValid(candidate), false);
    assert.equal(contactValid('mailto:push-support@cpsu.edu.ph'), true);
    assert.equal(contactValid('https://support.cpsu.edu.ph/help'), true);
  });

  test('accepts a syntactically complete synthetic profile without calling any server', () => {
    assert.deepEqual(issues(baseline()), []);
  });

  test('blocks missing evidence even with plausible URL and contact', () => {
    const profile = baseline();
    profile.deploymentApprovalReference = '';
    profile.privacyApprovalReference = '';
    profile.syntheticTestAccountsOnly = false;
    const problems = issues(profile);
    assert.ok(problems.some(x => x.includes('written reference')));
    assert.ok(problems.some(x => x.includes('Privacy/DPO')));
    assert.ok(problems.some(x => x.includes('Synthetic')));
  });

  test('requires exact review of all migrations, including concurrently added WP3', () => {
    const profile = baseline();
    profile.approvedMigrations = ['init_migration', 'push_notifications'];
    assert.ok(issues(profile).some(x => x.includes('migration')));
    profile.approvedMigrations = ['init_migration', 'push_notifications', 'wp3_concurrent', 'extra'];
    assert.ok(issues(profile).some(x => x.includes('migration')));
    profile.approvedMigrations = ['init_migration', 'push_notifications', 'wp3_concurrent'];
    assert.equal(issues(profile).length, 0);
  });

  test('blocks any Stage 6 push enrollment or delivery activation', () => {
    assert.ok(issues({ ...baseline(), pushSubscriptionsEnabled: true })
      .some(x => x.includes('switches')));
    assert.ok(issues({ ...baseline(), pushDeliveryEnabled: true })
      .some(x => x.includes('switches')));
  });

  test('blocks dirty source tree and unsafe static assets', () => {
    const problems = issues(baseline(), { sourceClean: false, builtSafe: false });
    assert.ok(problems.some(x => x.includes('pending edits')));
    assert.ok(problems.some(x => x.includes('private secrets')));
  });

  test('rejects credential fields in an approval manifest', () => {
    const problems = issues({ ...baseline(), databasePassword: 'FORBIDDEN_SYNTHETIC_TEST' });
    assert.ok(problems.some(x => x.includes('credential fields')));
  });
});
