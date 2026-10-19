import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { once } from 'node:events';
import { PlanStore } from '../src/plans.js';
import { RouterManager } from '../src/router.js';
import type { RouterProfile } from '../src/types.js';

async function mockRouter() {
  const calls: Array<{ method: string; params: unknown }> = [];
  const server = createServer(async (request, response) => {
    if (request.url === '/ui/flutter_bootstrap.js') {
      response.writeHead(200, { 'content-type': 'application/javascript' });
      response.end('const endpoint = "/cgi/service.cgi";');
      return;
    }
    if (request.url !== '/cgi/service.cgi' || request.method !== 'POST') {
      response.writeHead(404); response.end('not found'); return;
    }
    if (!request.headers.origin || !request.headers.referer?.endsWith('/ui/')) {
      response.writeHead(502, { 'content-type': 'text/html' }); response.end('<html><script>top.location="/login/login.cgi"</script></html>'); return;
    }
    let body = '';
    for await (const chunk of request) body += chunk;
    const rpc = JSON.parse(body) as { method: string; params: unknown };
    calls.push(rpc);
    response.setHeader('content-type', 'application/json');
    if (rpc.method === 'session/login') {
      response.setHeader('set-cookie', 'efm_session_id=test-session-token; HttpOnly; Path=/');
      response.end(JSON.stringify({ result: { authenticated: true } }));
    } else if (!request.headers.cookie?.includes('efm_session_id=test-session-token')) {
      response.end(JSON.stringify({ error: { code: -31998, message: 'login required' } }));
    } else if (rpc.method === 'api/has') {
      response.end(JSON.stringify({ result: true }));
    } else if (rpc.method === 'product/info') {
      response.end(JSON.stringify({ result: { model: 'TEST' } }));
    } else if (rpc.method === 'system/info') {
      response.end(JSON.stringify({ result: { firmware: '15.36.6' } }));
    } else if (rpc.method === 'portforward/get') {
      response.end(JSON.stringify({ result: { rules: [] } }));
    } else {
      response.end(JSON.stringify({ result: { ok: true, method: rpc.method } }));
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('mock did not start');
  return { server, calls, url: `http://127.0.0.1:${address.port}` };
}

test('iUX3 discovery, authentication, reads, and planned writes work end to end', async (t) => {
  const mock = await mockRouter();
  t.after(() => mock.server.close());
  const routerProfile: RouterProfile = { id: 'home', baseUrl: new URL(mock.url), username: 'admin', password: 'secret', allowInsecureRemoteHttp: false, timeoutMs: 3000 };
  const manager = new RouterManager(new Map([['home', routerProfile]]));
  const router = manager.get('home');
  const probe = await router.probe();
  assert.equal(probe.interface, 'iux3');
  assert.equal(probe.authenticated, false);
  assert.deepEqual(await router.read('product.info'), { model: 'TEST' });
  assert.equal(mock.calls.filter((call) => call.method === 'session/login').length, 1);
  const beforeUnsafeRead = mock.calls.length;
  await assert.rejects(router.read('system.name', 'changed-name'), /Use its write operation/);
  await assert.rejects(router.read('http.config', { port: 8080 }), /Use its write operation/);
  assert.equal(mock.calls.length, beforeUnsafeRead);
  await router.read('ddns.config');
  assert.deepEqual(mock.calls.at(-1), { method: 'ddns/config', params: 'iptime' });

  const store = new PlanStore(manager);
  const plan = await store.create('home', 'portforward.add', { name: 'web', protocol: 'tcp', external_port: 8080, internal_ip: '192.168.0.2', internal_port: 80 });
  assert.equal(plan.state, 'pending');
  assert.equal('confirmation' in plan, false);
  const beforeWrites = mock.calls.filter((call) => call.method === 'portforward/add').length;
  const applied = await store.apply(plan.id);
  assert.equal(applied.state, 'applied');
  assert.equal(mock.calls.filter((call) => call.method === 'portforward/add').length, beforeWrites + 1);
  assert.deepEqual(applied.verification, { rules: [] });
  await assert.rejects(store.apply(plan.id), (error: unknown) => (
    error instanceof Error && error.message === 'Plan is already applied'
  ));
});
