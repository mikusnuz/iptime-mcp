import { AuthRequiredError, CaptchaRequiredError, IptimeError } from '../errors.js';
import { RouterTransport } from '../transport.js';
import type { JsonObject, JsonValue, ProbeResult } from '../types.js';
import type { RouterAdapter } from './adapter.js';

type RpcEnvelope = { result?: JsonValue; error?: { code?: number; message?: string; msg?: string; data?: JsonValue } };

function envelope(value: JsonValue): RpcEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new IptimeError('Invalid iUX3 response', 'INVALID_RESPONSE');
  return value as RpcEnvelope;
}

export class Iux3Adapter implements RouterAdapter {
  readonly kind = 'iux3' as const;
  private captcha?: JsonValue;

  constructor(private readonly transport: RouterTransport) {}

  private async rpc(method: string, params?: JsonValue, resolveCaptcha = true): Promise<JsonValue> {
    const origin = this.transport.profile.baseUrl.origin;
    const value = envelope(await this.transport.json('/cgi/service.cgi', {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        origin,
        referer: new URL('/ui/', this.transport.profile.baseUrl).toString(),
      },
      body: JSON.stringify(params === undefined ? { method } : { method, params }),
    }));
    if (value.error) {
      const code = Number(value.error.code);
      if (code === -31998) throw new AuthRequiredError();
      if (code === -31997 && method === 'session/login') {
        const challenge = resolveCaptcha ? await this.newCaptcha().catch(() => value.error?.data ?? null) : value.error?.data ?? null;
        throw new CaptchaRequiredError(challenge);
      }
      if (code === -31996 && method === 'session/login') throw new IptimeError('Router rejected the username, password, or CAPTCHA', 'LOGIN_FAILED');
      throw new IptimeError(value.error.message ?? value.error.msg ?? `Router API error ${code}`, 'ROUTER_API_ERROR', value.error);
    }
    return value.result ?? null;
  }

  async probe(): Promise<ProbeResult> {
    try {
      const bootstrap = await this.transport.text('/ui/flutter_bootstrap.js');
      if (!bootstrap.includes('service.cgi')) return { interface: 'unknown', reachable: true, authenticated: false, reason: 'iUX3 marker not found' };
      try {
        const [product, system] = await Promise.all([this.rpc('product/info'), this.rpc('system/info')]);
        return { interface: this.kind, reachable: true, authenticated: true, product, system };
      } catch (error) {
        if (error instanceof AuthRequiredError) return { interface: this.kind, reachable: true, authenticated: false };
        throw error;
      }
    } catch (error) {
      return { interface: 'unknown', reachable: false, authenticated: false, reason: error instanceof Error ? error.message : String(error) };
    }
  }

  private async newCaptcha(): Promise<JsonValue> {
    const result = await this.rpc('captcha/new', undefined, false);
    this.captcha = result;
    return result;
  }

  async login(captchaCode?: string): Promise<JsonValue> {
    const { username, password } = this.transport.profile;
    if (!username || !password) throw new IptimeError('Router credentials are not configured', 'CREDENTIALS_NOT_CONFIGURED');
    const params: JsonObject = { id: username, pw: password };
    if (captchaCode) {
      const challenge = this.captcha && typeof this.captcha === 'object' && !Array.isArray(this.captcha) ? this.captcha : {};
      params.captcha = { ...(challenge as JsonObject), text: captchaCode };
    }
    const result = await this.rpc('session/login', params);
    this.captcha = undefined;
    return result;
  }

  async logout(): Promise<void> {
    try { await this.rpc('session/logout'); } finally { this.transport.clearSession(); }
  }

  call(method: string, params?: JsonValue): Promise<JsonValue> {
    return this.rpc(method, params);
  }

  async has(method: string): Promise<boolean | undefined> {
    try {
      const result = await this.rpc('api/has', method);
      if (typeof result === 'boolean') return result;
      if (typeof result === 'number') return result !== 0;
      if (typeof result === 'string') return ['1', 'true', 'yes'].includes(result.toLowerCase());
      if (result && typeof result === 'object' && !Array.isArray(result)) {
        const candidate = (result as JsonObject).has ?? (result as JsonObject).result;
        if (typeof candidate === 'boolean') return candidate;
      }
      return undefined;
    } catch (error) {
      if (error instanceof IptimeError && error.code === 'ROUTER_API_ERROR') return undefined;
      throw error;
    }
  }
}
