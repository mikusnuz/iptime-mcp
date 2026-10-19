import assert from 'node:assert/strict';
import test from 'node:test';
import { OPERATION_CATALOG, OPERATION_MAP, catalogSummary, operationSpec, validateParams, validateReadParams, validateWriteParams } from '../src/catalog.js';

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

test('shared configuration reads reject parameters that could change settings', () => {
  for (const write of OPERATION_CATALOG.filter((spec) => spec.operation === `${spec.method.replaceAll('/', '.')}.update`)) {
    const read = OPERATION_CATALOG.find((spec) => spec.mode === 'read' && spec.method === write.method);
    assert.ok(read);
    for (const value of [{ active: true }, ['write'], 'new-name', 1, false]) {
      assert.throws(() => validateReadParams(read, value), /Use its write operation/);
    }
    assert.equal(validateReadParams(read, {}), undefined);
    assert.equal(validateReadParams(read, null), undefined);
  }
  assert.equal(validateReadParams(operationSpec('ddns.config', 'read'), 'iptime'), 'iptime');
  assert.deepEqual(validateReadParams(operationSpec('syslog.show', 'read'), { page: 2 }), { page: 2 });
});

test('CWMP certificate parameters follow the observed 16.00.4 UI contract', () => {
  const spec = operationSpec('cwmp.set', 'write');
  assert.equal(spec.risk, 'critical');
  assert.equal(spec.readback, 'cwmp/get');
  assert.match(spec.paramsHint!, /acs.cacert/);
  const params = { active: true, acs: { inform: true, interval: 300, time: '', url: 'https://acs.example.com', user: 'test', pass: 'fixture-only', cacert: '-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----' }, cpe: { interface: 'wan1', port: 7547, user: 'test', pass: 'fixture-only' } };
  assert.deepEqual(validateWriteParams(spec, params), params);
  const cleared = { ...params, acs: { ...params.acs, cacert: '' } };
  assert.deepEqual(validateWriteParams(spec, cleared), cleared);
  assert.throws(() => validateWriteParams(spec, { acs: { cacert: params.acs.cacert } }), /complete active\/acs\/cpe/);
  assert.throws(() => validateWriteParams(spec, { ...params, acs: { ...params.acs, pass: '[redacted]' } }), /Redacted CWMP/);
  assert.deepEqual(validateWriteParams(spec, { active: false }), { active: false });
  for (const certificate of [true, null, 'not PEM', 'x'.repeat(8193), params.acs.cacert + '"', params.acs.cacert + '\\', params.acs.cacert + '\0', params.acs.cacert + 'PRIVATE KEY']) {
    assert.throws(() => validateWriteParams(spec, { acs: { cacert: certificate } }), /CA certificate PEM/);
  }
});

test('parameters reject prototype keys and oversized input', () => {
  assert.deepEqual(validateParams({ band: 1 }), { band: 1 });
  assert.equal(validateParams('lan'), 'lan');
  assert.deepEqual(validateParams(['wan1', 'lan1']), ['wan1', 'lan1']);
  assert.equal(validateParams(undefined), undefined);
  assert.throws(() => validateParams(JSON.parse('{"__proto__":{"polluted":true}}')));
  assert.throws(() => validateParams({ value: 'x'.repeat(130_000) }));
});
