#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { loadProfiles, publicProfile } from './config.js';
import { catalogSummary, OPERATION_CATALOG } from './catalog.js';
import { IptimeError } from './errors.js';
import { PlanStore } from './plans.js';
import { RouterManager } from './router.js';
import { sanitize } from './sanitize.js';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as { version: string };
const profiles = loadProfiles();
const routers = new RouterManager(profiles);
const plans = new PlanStore(routers);
const server = new McpServer({ name: 'iptime-mcp', version: pkg.version }, {
  instructions: 'Use iptime_status, then iptime_capabilities before choosing an operation. Reads may run directly. Create a plan before every router write and show its operation, parameters, risk, and previous state. A specific user request for the same change is sufficient authorization; do not ask the user to repeat a token or plan id. Ask for an additional natural-language confirmation only for critical-risk plans that the user has not already explicitly authorized. Never ask for or pass router credentials as tool arguments. Do not retry a write when its outcome is unknown; inspect the returned verification state first.',
});

function output(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(sanitize(value), null, 2) }] };
}

function failure(error: unknown) {
  const body = error instanceof IptimeError
    ? { error: error.code, message: error.message, details: sanitize(error.details) }
    : { error: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : String(error) };
  return { ...output(body), isError: true };
}

function register(
  name: string,
  description: string,
  shape: Record<string, z.ZodTypeAny>,
  handler: (args: Record<string, unknown>) => Promise<unknown>,
): void {
  const readOnly = /^iptime_(?:status|capabilities|list_operations|read|list_plans)$/.test(name);
  server.tool(name, description, shape, {
    readOnlyHint: readOnly,
    destructiveHint: name === 'iptime_apply_change',
    idempotentHint: readOnly,
    openWorldHint: true,
  }, async (args) => {
    try { return output(await handler(args)); } catch (error) { return failure(error); }
  });
}

const routerId = z.string().min(1).optional().describe('Configured router id; optional when exactly one router exists');
const params = z.unknown().optional().describe('JSON parameters for the selected ipTIME operation; may be an object, array, string, number, boolean, or null');

register('iptime_status', 'Detect the router interface, authenticate if configured, and read product/system status.', { router_id: routerId }, async ({ router_id }) => {
  const router = routers.get(router_id as string | undefined);
  let probe = await router.probe();
  if (probe.reachable && !probe.authenticated && router.profile.username && router.profile.password) {
    await router.login();
    probe = await router.probe();
  }
  return { router: publicProfile(router.profile), probe };
});

register('iptime_login', 'Authenticate using credentials from the MCP environment. Credentials are never accepted as tool arguments.', {
  router_id: routerId,
  captcha_code: z.string().min(1).max(32).optional().describe('CAPTCHA answer, only after the router requested one'),
}, async ({ router_id, captcha_code }) => ({ authenticated: true, result: await routers.get(router_id as string | undefined).login(captcha_code as string | undefined) }));

register('iptime_logout', 'End the router admin session.', { router_id: routerId }, async ({ router_id }) => {
  await routers.get(router_id as string | undefined).logout();
  return { authenticated: false };
});

register('iptime_capabilities', 'Discover which catalogued operations this model and firmware actually expose.', {
  router_id: routerId,
  domain: z.string().optional().describe('Optional domain filter, such as wireless, network, vpn, or usb'),
  refresh: z.boolean().optional().default(false),
}, async ({ router_id, domain, refresh }) => {
  const capabilities = await routers.get(router_id as string | undefined).capabilities(Boolean(refresh));
  return { capabilities: domain ? capabilities.filter((item) => item.domain === domain) : capabilities };
});

register('iptime_list_operations', 'List the fixed, auditable operation catalog. This does not contact the router.', {
  domain: z.string().optional(),
  mode: z.enum(['read', 'write']).optional(),
}, async ({ domain, mode }) => ({
  summary: catalogSummary(),
  operations: OPERATION_CATALOG.filter((item) => (!domain || item.domain === domain) && (!mode || item.mode === mode)),
}));

register('iptime_read', 'Run a read-only operation from iptime_list_operations.', {
  router_id: routerId,
  operation: z.string().min(1),
  params,
}, async ({ router_id, operation, params: rawParams }) => {
  const router = routers.get(router_id as string | undefined);
  await router.assertSupported(operation as string);
  return { operation, result: await router.read(operation as string, rawParams) };
});

register('iptime_backup_config', 'Download the current router configuration to a new local .config file. Existing files are never overwritten.', {
  router_id: routerId,
  output_path: z.string().min(1).describe('Destination path ending in .config'),
}, async ({ router_id, output_path }) => {
  const destination = resolve(output_path as string);
  if (!destination.toLowerCase().endsWith('.config')) throw new IptimeError('Backup output must end in .config', 'INVALID_OUTPUT_PATH');
  const result = await routers.get(router_id as string | undefined).read('config.backup');
  const encoded = typeof result === 'string' ? result : result && typeof result === 'object' && !Array.isArray(result)
    ? String((result as Record<string, unknown>).data ?? (result as Record<string, unknown>).content ?? '') : '';
  const base64 = encoded.replace(/^data:[^,]+,\s*/i, '').replace(/\s+/g, '');
  if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new IptimeError('Router returned an invalid configuration backup', 'INVALID_BACKUP');
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length < 1 || bytes.length > 32 * 1024 * 1024) throw new IptimeError('Configuration backup has an invalid size', 'INVALID_BACKUP');
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, bytes, { flag: 'wx', mode: 0o600 });
  return { path: destination, size: bytes.length };
});

register('iptime_plan_change', 'Create an expiring immutable plan for a router change. No setting is changed by this tool.', {
  router_id: routerId,
  operation: z.string().min(1).describe('A write operation from iptime_list_operations'),
  params,
}, async ({ router_id, operation, params: rawParams }) => plans.create(router_id as string | undefined, operation as string, rawParams));

register('iptime_plan_firmware_upgrade', 'Hash a local firmware file and create a critical-risk upgrade plan. No upload occurs yet.', {
  router_id: routerId,
  file_path: z.string().min(1),
}, async ({ router_id, file_path }) => plans.createAttachment(router_id as string | undefined, 'firmware.upgrade', file_path as string));

register('iptime_plan_config_restore', 'Hash a local ipTIME configuration backup and create a critical-risk restore plan.', {
  router_id: routerId,
  file_path: z.string().min(1),
}, async ({ router_id, file_path }) => plans.createAttachment(router_id as string | undefined, 'config.restore.file', file_path as string));

register('iptime_apply_change', 'Apply exactly one pending plan. No confirmation token or repeated plan id is required.', {
  plan_id: z.string().uuid(),
}, async ({ plan_id }) => plans.apply(plan_id as string));

register('iptime_cancel_change', 'Cancel a pending change plan.', { plan_id: z.string().uuid() }, async ({ plan_id }) => plans.cancel(plan_id as string));

register('iptime_list_plans', 'List plans and their current state.', { router_id: routerId }, async ({ router_id }) => ({ plans: plans.list(router_id as string | undefined) }));

server.resource('configuration', 'iptime://configuration', {
  description: 'Configured router profiles with all credentials omitted', mimeType: 'application/json',
}, async () => ({ contents: [{ uri: 'iptime://configuration', mimeType: 'application/json', text: JSON.stringify({ server: { version: pkg.version }, routers: [...profiles.values()].map(publicProfile) }, null, 2) }] }));

server.resource('operation-catalog', 'iptime://operations', {
  description: 'Fixed router operation catalog and risk classification', mimeType: 'application/json',
}, async () => ({ contents: [{ uri: 'iptime://operations', mimeType: 'application/json', text: JSON.stringify({ summary: catalogSummary(), operations: OPERATION_CATALOG }, null, 2) }] }));

const transport = new StdioServerTransport();
await server.connect(transport);
