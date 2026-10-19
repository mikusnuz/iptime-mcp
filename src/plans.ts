import { createHash, randomUUID } from 'node:crypto';
import { stat, readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { IptimeError } from './errors.js';
import { operationSpec, validateWriteParams } from './catalog.js';
import type { ChangePlan, JsonObject, JsonValue } from './types.js';
import type { RouterManager } from './router.js';

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

function digest(plan: Omit<ChangePlan, 'digest'>): string {
  return createHash('sha256').update(stable(plan)).digest('hex');
}

async function fileDescriptor(path: string, kind: 'firmware' | 'configuration') {
  const absolute = resolve(path);
  const extension = absolute.toLowerCase();
  if (kind === 'firmware' && !extension.endsWith('.bin')) throw new IptimeError('ipTIME firmware files must use the .bin extension', 'INVALID_ATTACHMENT');
  if (kind === 'configuration' && !extension.endsWith('.config')) throw new IptimeError('ipTIME backup files must use the .config extension', 'INVALID_ATTACHMENT');
  const metadata = await stat(absolute);
  if (!metadata.isFile()) throw new IptimeError('Attachment path is not a file', 'INVALID_ATTACHMENT');
  if (metadata.size < 1 || metadata.size > 256 * 1024 * 1024) throw new IptimeError('Attachment has an invalid size', 'INVALID_ATTACHMENT');
  const bytes = await readFile(absolute);
  return { path: absolute, size: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex'), kind } as const;
}

export class PlanStore {
  private readonly plans = new Map<string, ChangePlan>();
  private readonly locks = new Map<string, Promise<void>>();

  constructor(private readonly routers: RouterManager) {}

  async create(routerId: string | undefined, operation: string, rawParams?: unknown): Promise<ChangePlan> {
    const router = this.routers.get(routerId);
    const spec = operationSpec(operation, 'write');
    await router.assertSupported(operation);
    const params = validateWriteParams(spec, rawParams);
    let before: JsonValue | undefined;
    if (spec.readback) {
      // Never reuse write parameters for a readback. Several iUX3 `config`
      // methods update state when configuration fields are present.
      try { before = await router.callMethod(spec.readback, undefined, 'read'); } catch { before = undefined; }
    }
    return this.save({ routerId: router.profile.id, operation, method: spec.method, params, risk: spec.risk as Exclude<typeof spec.risk, 'read'>, before });
  }

  async createAttachment(routerId: string | undefined, operation: 'firmware.upgrade' | 'config.restore.file', path: string): Promise<ChangePlan> {
    const router = this.routers.get(routerId);
    const kind = operation === 'firmware.upgrade' ? 'firmware' : 'configuration';
    await router.assertSupported(operation === 'firmware.upgrade' ? 'firmware.upgrade.prepare' : 'config.restore');
    const attachment = await fileDescriptor(path, kind);
    const method = operation === 'firmware.upgrade' ? 'firmware/upgrade/prepare' : 'config/restore';
    return this.save({ routerId: router.profile.id, operation, method, params: { filename: basename(path) }, risk: 'critical', attachment });
  }

  private save(fields: Pick<ChangePlan, 'routerId' | 'operation' | 'method' | 'params' | 'risk' | 'before' | 'attachment'>): ChangePlan {
    const id = randomUUID();
    const createdAt = new Date();
    const unsigned: Omit<ChangePlan, 'digest'> = {
      id, ...fields, createdAt: createdAt.toISOString(), expiresAt: new Date(createdAt.getTime() + 10 * 60_000).toISOString(),
      state: 'pending',
    };
    const plan = { ...unsigned, digest: digest(unsigned) };
    this.plans.set(id, plan);
    return structuredClone(plan);
  }

  list(routerId?: string): ChangePlan[] {
    return [...this.plans.values()].filter((plan) => !routerId || plan.routerId === routerId).map((plan) => structuredClone(plan));
  }

  get(id: string): ChangePlan {
    const plan = this.plans.get(id);
    if (!plan) throw new IptimeError('Change plan not found', 'PLAN_NOT_FOUND');
    return plan;
  }

  cancel(id: string): ChangePlan {
    const plan = this.get(id);
    if (plan.state !== 'pending') throw new IptimeError(`Plan is already ${plan.state}`, 'PLAN_NOT_PENDING');
    plan.state = 'cancelled';
    return structuredClone(plan);
  }

  async apply(id: string): Promise<ChangePlan> {
    const current = this.locks.get(this.get(id).routerId) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((resolvePromise) => { release = resolvePromise; });
    this.locks.set(this.get(id).routerId, current.then(() => next));
    await current;
    try { return await this.applyLocked(id); } finally { release(); }
  }

  private async applyLocked(id: string): Promise<ChangePlan> {
    const plan = this.get(id);
    if (plan.state !== 'pending') throw new IptimeError(`Plan is already ${plan.state}`, 'PLAN_NOT_PENDING');
    if (Date.now() > Date.parse(plan.expiresAt)) { plan.state = 'expired'; throw new IptimeError('Change plan expired; create a new plan', 'PLAN_EXPIRED'); }
    const { digest: storedDigest, ...unsigned } = plan;
    if (digest(unsigned) !== storedDigest) throw new IptimeError('Change plan integrity check failed', 'PLAN_TAMPERED');
    const router = this.routers.get(plan.routerId);
    try {
      if (plan.attachment) await this.applyAttachment(router, plan);
      else plan.result = await router.callMethod(plan.method, plan.params, 'write');
      const spec = plan.attachment ? undefined : operationSpec(plan.operation, 'write');
      if (spec?.readback) {
        try { plan.verification = await router.callMethod(spec.readback, undefined, 'read'); } catch { plan.verification = { status: 'unavailable' }; }
      }
      plan.state = 'applied';
      return structuredClone(plan);
    } catch (error) {
      plan.state = 'failed';
      const spec = plan.attachment ? undefined : operationSpec(plan.operation, 'write');
      if (spec?.readback && error instanceof IptimeError && ['NETWORK_ERROR', 'TIMEOUT', 'HTTP_ERROR'].includes(error.code)) {
        try { plan.verification = await router.callMethod(spec.readback, undefined, 'read'); } catch { plan.verification = { status: 'unavailable' }; }
        throw new IptimeError('The router did not confirm the write. State was reconciled where possible; inspect verification and do not retry blindly.', 'WRITE_OUTCOME_UNKNOWN', {
          originalError: error.code,
          verification: plan.verification,
        });
      }
      throw error;
    }
  }

  private async applyAttachment(router: ReturnType<RouterManager['get']>, plan: ChangePlan): Promise<void> {
    const attachment = plan.attachment as NonNullable<ChangePlan['attachment']>;
    const current = await fileDescriptor(attachment.path, attachment.kind);
    if (current.sha256 !== attachment.sha256 || current.size !== attachment.size) throw new IptimeError('Attachment changed after the plan was created', 'ATTACHMENT_CHANGED');
    const bytes = await readFile(attachment.path);
    if (attachment.kind === 'configuration') {
      plan.result = await router.callMethod('config/restore', { filename: basename(attachment.path), data: bytes.toString('base64') }, 'write');
      return;
    }
    await router.callMethod('firmware/upgrade/prepare', { method: 'manual' }, 'write');
    const body = new FormData();
    body.append('file', new Blob([bytes], { type: 'application/octet-stream' }), 'upgrade');
    let response: Response;
    try {
      ({ response } = await router.transport.request('/cgi/firmware.cgi', { method: 'POST', body }));
    } catch (error) {
      let status: JsonValue = { status: 'unavailable' };
      try { status = await router.callMethod('firmware/upgrade/status', undefined, 'read'); } catch {}
      throw new IptimeError('The firmware upload response was lost. Check firmware status and do not upload the image again until the current upgrade state is known.', 'FIRMWARE_UPLOAD_OUTCOME_UNKNOWN', { status, originalError: error instanceof IptimeError ? error.code : 'NETWORK_ERROR' });
    }
    if (!response.ok) throw new IptimeError(`Firmware upload failed with HTTP ${response.status}`, 'FIRMWARE_UPLOAD_FAILED');
    plan.result = { uploaded: true, sha256: attachment.sha256, size: attachment.size };
  }
}
