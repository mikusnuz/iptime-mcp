import { AuthRequiredError, IptimeError } from './errors.js';
import { resolveTarget, safeUrl, verifyTlsFingerprint } from './security.js';
import type { JsonValue, RouterProfile } from './types.js';
import { request as httpRequest } from 'node:http';

const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

function splitCookies(header: string): string[] {
  return header.split(/,(?=\s*[^;,=]+=[^;,]+)/g);
}

export class RouterTransport {
  private cookies = new Map<string, string>();

  constructor(readonly profile: RouterProfile) {}

  clearSession(): void {
    this.cookies.clear();
  }

  hasSession(): boolean {
    return this.cookies.has('efm_session_id');
  }

  setSession(value: string): void {
    if (!/^[A-Za-z0-9._~-]{8,512}$/.test(value)) throw new IptimeError('Router returned an invalid session token', 'INVALID_SESSION');
    this.cookies.set('efm_session_id', value);
  }

  private storeCookies(headers: Headers): void {
    const values = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ??
      (headers.get('set-cookie') ? splitCookies(headers.get('set-cookie') as string) : []);
    for (const value of values) {
      const [pair] = value.split(';', 1);
      const separator = pair.indexOf('=');
      if (separator < 1) continue;
      const name = pair.slice(0, separator).trim();
      const cookieValue = pair.slice(separator + 1).trim();
      if (name === 'efm_session_id' && /^[A-Za-z0-9._~-]{8,512}$/.test(cookieValue)) this.cookies.set(name, cookieValue);
    }
  }

  async request(path: string, init: RequestInit = {}): Promise<{ response: Response; bytes: Uint8Array }> {
    await resolveTarget(this.profile);
    await verifyTlsFingerprint(this.profile);
    const url = safeUrl(this.profile.baseUrl, path);
    const headers = new Headers(init.headers);
    headers.set('accept', headers.get('accept') ?? 'application/json, text/plain, */*');
    headers.set('user-agent', 'iptime-mcp/0.1');
    if (this.cookies.size) headers.set('cookie', [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; '));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.profile.timeoutMs);
    try {
      // Some ipTIME firmware emits a bare LF in Set-Cookie. Browsers accept it,
      // while strict Fetch parsers reject the whole response. Node's opt-in
      // lenient HTTP parser matches browser behavior for plain-HTTP routers.
      const response = url.protocol === 'http:'
        ? await this.requestHttp(url, init, headers, controller.signal)
        : await fetch(url, { ...init, headers, redirect: 'manual', signal: controller.signal });
      if (response.status >= 300 && response.status < 400) {
        throw new IptimeError('Router redirect was blocked', 'REDIRECT_BLOCKED', { status: response.status });
      }
      this.storeCookies(response.headers);
      const declared = Number(response.headers.get('content-length') || 0);
      if (declared > MAX_RESPONSE_BYTES) throw new IptimeError('Router response is too large', 'RESPONSE_TOO_LARGE');
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > MAX_RESPONSE_BYTES) throw new IptimeError('Router response is too large', 'RESPONSE_TOO_LARGE');
      return { response, bytes };
    } catch (error) {
      if (error instanceof IptimeError) throw error;
      if (error instanceof Error && error.name === 'AbortError') throw new IptimeError('Router request timed out', 'TIMEOUT');
      throw new IptimeError(error instanceof Error ? error.message : 'Router request failed', 'NETWORK_ERROR');
    } finally {
      clearTimeout(timer);
    }
  }

  private async requestHttp(url: URL, init: RequestInit, initialHeaders: Headers, signal: AbortSignal): Promise<Response> {
    const prepared = new Request(url, { ...init, headers: initialHeaders, signal: undefined });
    const headers = new Headers(prepared.headers);
    const body = prepared.body ? new Uint8Array(await prepared.arrayBuffer()) : undefined;
    if (body) headers.set('content-length', String(body.byteLength));

    return new Promise<Response>((resolvePromise, rejectPromise) => {
      const request = httpRequest(url, {
        method: prepared.method,
        headers: Object.fromEntries(headers.entries()),
        insecureHTTPParser: true,
      }, (incoming) => {
        const chunks: Uint8Array[] = [];
        let size = 0;
        incoming.on('data', (chunk: Buffer) => {
          size += chunk.byteLength;
          if (size > MAX_RESPONSE_BYTES) {
            incoming.destroy(new IptimeError('Router response is too large', 'RESPONSE_TOO_LARGE'));
            return;
          }
          chunks.push(chunk);
        });
        incoming.once('error', rejectPromise);
        incoming.once('end', () => {
          const responseHeaders = new Headers();
          for (let index = 0; index < incoming.rawHeaders.length; index += 2) {
            responseHeaders.append(incoming.rawHeaders[index], incoming.rawHeaders[index + 1] ?? '');
          }
          const bytes = Buffer.concat(chunks);
          resolvePromise(new Response(bytes.byteLength ? bytes : null, {
            status: incoming.statusCode ?? 500,
            statusText: incoming.statusMessage,
            headers: responseHeaders,
          }));
        });
      });
      request.once('error', rejectPromise);
      const abort = () => request.destroy(new DOMException('The operation was aborted', 'AbortError'));
      if (signal.aborted) abort();
      else signal.addEventListener('abort', abort, { once: true });
      request.once('close', () => signal.removeEventListener('abort', abort));
      if (body) request.end(body);
      else request.end();
    });
  }

  async text(path: string, init: RequestInit = {}): Promise<string> {
    const { response, bytes } = await this.request(path, init);
    const text = new TextDecoder().decode(bytes);
    if (!response.ok) throw new IptimeError(`Router returned HTTP ${response.status}`, 'HTTP_ERROR', { status: response.status });
    return text;
  }

  async json(path: string, init: RequestInit = {}): Promise<JsonValue> {
    const { response, bytes } = await this.request(path, init);
    const text = new TextDecoder().decode(bytes);
    if (/^\s*<(!doctype|html|script)/i.test(text)) {
      if (/login|location\.href|parent\.location/i.test(text)) throw new AuthRequiredError();
      throw new IptimeError('Expected JSON but router returned HTML', 'INVALID_RESPONSE');
    }
    let value: JsonValue;
    try {
      value = JSON.parse(text) as JsonValue;
    } catch {
      throw new IptimeError('Router returned malformed JSON', 'INVALID_RESPONSE', { status: response.status });
    }
    if (!response.ok) throw new IptimeError(`Router returned HTTP ${response.status}`, 'HTTP_ERROR', { status: response.status, value });
    return value;
  }
}
