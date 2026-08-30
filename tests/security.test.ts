import assert from 'node:assert/strict';
import test from 'node:test';
import { isPrivateAddress, resolveTarget, safeUrl } from '../src/security.js';
import type { RouterProfile } from '../src/types.js';

function profile(url: string, allow = false): RouterProfile {
  return { id: 'test', baseUrl: new URL(url), allowInsecureRemoteHttp: allow, timeoutMs: 1000 };
}

test('private, loopback, link-local, and carrier-grade NAT addresses are local', () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '172.16.1.1', '192.168.0.1', '100.64.0.1', '::1', 'fd00::1', 'fe80::1']) {
    assert.equal(isPrivateAddress(address), true, address);
  }
  assert.equal(isPrivateAddress('8.8.8.8'), false);
  assert.equal(isPrivateAddress('2001:4860:4860::8888'), false);
});

test('public plain HTTP is blocked unless explicitly allowed', async () => {
  await assert.rejects(resolveTarget(profile('http://8.8.8.8')), (error: any) => error.code === 'INSECURE_REMOTE_HTTP');
  const result = await resolveTarget(profile('http://8.8.8.8', true));
  assert.equal(result.remote, true);
});

test('endpoint construction cannot leave the router origin', () => {
  const base = new URL('http://192.168.0.1/');
  assert.equal(safeUrl(base, '/cgi/service.cgi').origin, base.origin);
  assert.throws(() => safeUrl(base, '//attacker.example/path'));
});
