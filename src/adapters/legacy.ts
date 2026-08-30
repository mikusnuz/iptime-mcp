import { AuthRequiredError, IptimeError } from '../errors.js';
import { RouterTransport } from '../transport.js';
import type { InterfaceKind, JsonObject, JsonValue, ProbeResult } from '../types.js';
import type { RouterAdapter } from './adapter.js';

const LEGACY_READS: Record<string, string> = {
  'system/info': '/login/hostinfo2.cgi',
  'dhcpd/lease/show': '/cgi/iux_get.cgi?tmenu=netinfo&smenu=dhcpd&act=data',
  'dhcpd/config/get': '/cgi/iux_get.cgi?tmenu=netinfo&smenu=dhcpd&act=config',
  'portforward/get': '/sess-bin/download_portforward.cgi',
  'wol/show': '/cgi/iux_get.cgi?tmenu=expertconf&smenu=wollist',
};

function form(values: Record<string, string>): string {
  return new URLSearchParams(values).toString();
}

export class LegacyAdapter implements RouterAdapter {
  constructor(private readonly transport: RouterTransport, readonly kind: Exclude<InterfaceKind, 'iux3' | 'unknown'>) {}

  async probe(): Promise<ProbeResult> {
    try {
      const path = this.kind === 'mobile-iux' ? '/login/hostinfo2.cgi' : '/sess-bin/login_session.cgi?noauto=1';
      const text = await this.transport.text(path);
      return { interface: this.kind, reachable: true, authenticated: !/login|passwd|captcha/i.test(text) };
    } catch (error) {
      return { interface: 'unknown', reachable: false, authenticated: false, reason: error instanceof Error ? error.message : String(error) };
    }
  }

  async login(captchaCode?: string): Promise<JsonValue> {
    const { username, password } = this.transport.profile;
    if (!username || !password) throw new IptimeError('Router credentials are not configured', 'CREDENTIALS_NOT_CONFIGURED');
    const loginPage = await this.transport.text('/sess-bin/login_session.cgi?noauto=1', { headers: { referer: new URL('/login/login.cgi', this.transport.profile.baseUrl).toString() } });
    const captchaFile = loginPage.match(/captcha_file[^=]*[=:]\s*["']([^"']+)/i)?.[1] ?? '';
    if (captchaFile && !captchaCode) {
      throw new IptimeError('Legacy router login requires CAPTCHA. Open the router admin page once and retry with iptime_login captcha_code.', 'CAPTCHA_REQUIRED', { captchaFile });
    }
    const response = await this.transport.text('/sess-bin/login_handler.cgi', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', referer: new URL('/login/login.cgi', this.transport.profile.baseUrl).toString() },
      body: form({ init_status: '1', captcha_on: captchaFile ? '1' : '0', captcha_file: captchaFile, username, passwd: password, default_passwd: '', captcha_code: captchaCode ?? '' }),
    });
    const token = response.match(/setCookie\(\s*["']([^"']+)["']/i)?.[1];
    if (!token) throw new IptimeError('Legacy router rejected the login', 'LOGIN_FAILED');
    this.transport.setSession(token);
    return { authenticated: true };
  }

  async logout(): Promise<void> {
    try { await this.transport.text('/sess-bin/login_session.cgi?logout=1'); } finally { this.transport.clearSession(); }
  }

  async call(method: string, params?: JsonValue): Promise<JsonValue> {
    const readPath = LEGACY_READS[method];
    if (readPath) {
      const text = await this.transport.text(readPath);
      if (/login_session|login_handler|name=["']passwd/i.test(text)) throw new AuthRequiredError();
      return { format: 'legacy', text };
    }
    throw new IptimeError(`Operation ${method} is not safely mapped for the legacy interface`, 'UNSUPPORTED_OPERATION');
  }

  async has(method: string): Promise<boolean> {
    return method in LEGACY_READS;
  }
}
