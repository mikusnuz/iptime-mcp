import { AuthRequiredError, IptimeError } from './errors.js';
import { OPERATION_CATALOG, operationSpec, validateParams } from './catalog.js';
import { detectAdapter } from './detect.js';
import { RouterTransport } from './transport.js';
import type { RouterAdapter } from './adapters/adapter.js';
import type { Capability, JsonValue, ProbeResult, RouterProfile } from './types.js';

export class RouterHandle {
  readonly transport: RouterTransport;
  private adapter?: RouterAdapter;
  private capabilityCache?: { at: number; values: Capability[] };
  private authPromise?: Promise<JsonValue>;

  constructor(readonly profile: RouterProfile) {
    this.transport = new RouterTransport(profile);
  }

  async getAdapter(): Promise<RouterAdapter> {
    return this.adapter ??= await detectAdapter(this.transport);
  }

  async probe(): Promise<ProbeResult> {
    return (await this.getAdapter()).probe();
  }

  async login(captchaCode?: string): Promise<JsonValue> {
    if (!captchaCode && this.authPromise) return this.authPromise;
    const action = (async () => (await this.getAdapter()).login(captchaCode))();
    if (!captchaCode) this.authPromise = action;
    try {
      const result = await action;
      this.capabilityCache = undefined;
      return result;
    } finally {
      if (!captchaCode) this.authPromise = undefined;
    }
  }

  async logout(): Promise<void> {
    await (await this.getAdapter()).logout();
    this.capabilityCache = undefined;
  }

  private async ensureSession(): Promise<void> {
    if (!this.transport.hasSession()) await this.login();
  }

  async callMethod(method: string, params?: JsonValue, mode: 'read' | 'write' = 'read'): Promise<JsonValue> {
    const adapter = await this.getAdapter();
    await this.ensureSession();
    try {
      return await adapter.call(method, params);
    } catch (error) {
      if (error instanceof AuthRequiredError && mode === 'read') {
        this.transport.clearSession();
        await this.login();
        return adapter.call(method, params);
      }
      throw error;
    }
  }

  async read(operation: string, params?: unknown): Promise<JsonValue> {
    const spec = operationSpec(operation, 'read');
    const validated = validateParams(params);
    return this.callMethod(spec.method, validated === undefined ? spec.defaultParams : validated, 'read');
  }

  async write(operation: string, params?: unknown): Promise<JsonValue> {
    const spec = operationSpec(operation, 'write');
    return this.callMethod(spec.method, validateParams(params), 'write');
  }

  async capabilities(force = false): Promise<Capability[]> {
    if (!force && this.capabilityCache && Date.now() - this.capabilityCache.at < 5 * 60_000) return this.capabilityCache.values;
    const adapter = await this.getAdapter();
    await this.ensureSession();
    const values: Capability[] = [];
    const methodSupport = new Map<string, boolean | undefined>();
    const queue = [...new Set(OPERATION_CATALOG.map((spec) => spec.method))];
    const workers = Array.from({ length: Math.min(6, queue.length) }, async () => {
      while (queue.length) {
        const method = queue.shift();
        if (!method) break;
        let available: boolean | undefined;
        try { available = await adapter.has(method); } catch { available = undefined; }
        methodSupport.set(method, available);
      }
    });
    await Promise.all(workers);
    for (const spec of OPERATION_CATALOG) {
      const available = methodSupport.get(spec.method);
      values.push({
          operation: spec.operation,
          domain: spec.domain,
          mode: spec.mode,
          risk: spec.risk,
          state: available === true ? 'full' : available === false ? 'unsupported' : spec.mode === 'read' ? 'unknown' : 'unknown',
          method: spec.method,
          interface: adapter.kind,
      });
    }
    values.sort((a, b) => a.operation.localeCompare(b.operation));
    this.capabilityCache = { at: Date.now(), values };
    return values;
  }

  async assertSupported(operation: string): Promise<void> {
    const capability = (await this.capabilities()).find((item) => item.operation === operation);
    if (!capability) throw new IptimeError(`Unknown operation: ${operation}`, 'UNKNOWN_OPERATION');
    if (capability.state === 'unsupported') throw new IptimeError(`Router does not support ${operation}`, 'UNSUPPORTED_OPERATION');
    if (capability.state === 'unknown' && capability.mode === 'write') {
      throw new IptimeError(`Write support for ${operation} could not be verified on this firmware`, 'UNVERIFIED_OPERATION');
    }
  }
}

export class RouterManager {
  private readonly handles = new Map<string, RouterHandle>();

  constructor(readonly profiles: Map<string, RouterProfile>) {}

  get(routerId?: string): RouterHandle {
    const id = routerId ?? (this.profiles.size === 1 ? this.profiles.keys().next().value as string : undefined);
    if (!id) throw new IptimeError('router_id is required when multiple or no routers are configured', 'ROUTER_ID_REQUIRED');
    const profile = this.profiles.get(id);
    if (!profile) throw new IptimeError(`Router not configured: ${id}`, 'ROUTER_NOT_FOUND');
    let handle = this.handles.get(id);
    if (!handle) {
      handle = new RouterHandle(profile);
      this.handles.set(id, handle);
    }
    return handle;
  }
}
