import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitize } from '../src/sanitize.js';

test('credentials and sessions are recursively redacted', () => {
  assert.deepEqual(sanitize({ username: 'admin', password: 'x', nested: { session_id: 'abc', token: 'def', wpaKey: 'ghi', normal: 1 } }), {
    username: 'admin', password: '[redacted]', nested: { session_id: '[redacted]', token: '[redacted]', wpaKey: '[redacted]', normal: 1 },
  });
});

test('CWMP ACS and CPE password fields are redacted', () => {
  assert.deepEqual(sanitize({ acs: { pass: 'fixture-acs' }, cpe: { pass: 'fixture-cpe' } }), {
    acs: { pass: '[redacted]' }, cpe: { pass: '[redacted]' },
  });
});
