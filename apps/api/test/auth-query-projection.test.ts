import { describe, expect, test } from 'bun:test';
import { authenticationUserSelect } from '../src/auth.js';

describe('authenticated request data minimization', () => {
  test('only retrieves fields used by session authorization; never passwordHash', () => {
    expect(authenticationUserSelect).toEqual({
      id: true,
      email: true,
      displayName: true,
      status: true,
      roles: { select: { role: true, campusId: true } },
    });
    expect(JSON.stringify(authenticationUserSelect)).not.toContain('passwordHash');
  });
});
