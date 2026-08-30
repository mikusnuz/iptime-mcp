import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';
import { LegacyAdapter } from '../src/adapters/legacy.js';
import { RouterTransport } from '../src/transport.js';
import type { RouterProfile } from '../src/types.js';

test('legacy DHCP configuration uses the catalogued method name', async (t) => {
  let requestedPath = '';
  const server = createServer((request, response) => {
    requestedPath = request.url ?? '';
    response.writeHead(200, { 'content-type': 'text/plain' });
    response.end('legacy-dhcp-config');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());

  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('mock did not start');
  const profile: RouterProfile = {
    id: 'legacy',
    baseUrl: new URL(`http://127.0.0.1:${address.port}`),
    allowInsecureRemoteHttp: false,
    timeoutMs: 3000,
  };
  const adapter = new LegacyAdapter(new RouterTransport(profile), 'mobile-iux');

  assert.deepEqual(await adapter.call('dhcpd/config/get'), { format: 'legacy', text: 'legacy-dhcp-config' });
  assert.equal(requestedPath, '/cgi/iux_get.cgi?tmenu=netinfo&smenu=dhcpd&act=config');
});
