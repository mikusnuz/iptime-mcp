import assert from 'node:assert/strict';
import test from 'node:test';
import { OPERATION_CATALOG, OPERATION_MAP, catalogSummary, operationSpec, validateParams } from '../src/catalog.js';

test('operation catalog is unique and covers every management domain', () => {
  assert.equal(OPERATION_MAP.size, OPERATION_CATALOG.length);
  const summary = catalogSummary();
  for (const domain of ['administration', 'system', 'network', 'dhcp', 'routing', 'wireless', 'easymesh', 'nat', 'security', 'qos', 'vpn', 'remote', 'usb', 'automation']) {
    assert.ok(summary[domain], `missing domain ${domain}`);
    assert.ok(summary[domain].read + summary[domain].write > 0);
  }
  assert.equal(operationSpec('product.info', 'read').method, 'product/info');
  assert.equal(operationSpec('admin.account.update', 'write').method, 'admin/account');
  assert.equal(operationSpec('wol.signal', 'write').risk, 'reversible');
  assert.equal(operationSpec('routine.expire', 'write').mode, 'write');
  assert.equal(operationSpec('http.config.update', 'write').risk, 'critical');
  assert.equal(operationSpec('http.config.update', 'write').domain, 'administration');
  assert.equal(operationSpec('system.temperature', 'read').defaultParams, 'cpu');
});

test('parameters reject prototype keys and oversized input', () => {
  assert.deepEqual(validateParams({ band: 1 }), { band: 1 });
  assert.equal(validateParams('lan'), 'lan');
  assert.deepEqual(validateParams(['wan1', 'lan1']), ['wan1', 'lan1']);
  assert.equal(validateParams(undefined), undefined);
  assert.throws(() => validateParams(JSON.parse('{"__proto__":{"polluted":true}}')));
  assert.throws(() => validateParams({ value: 'x'.repeat(130_000) }));
});
