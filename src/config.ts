import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { IptimeError } from './errors.js';
import type { RouterProfile } from './types.js';

type RawProfile = {
  id?: string;
  url?: string;
  username?: string;
  password?: string;
  username_env?: string;
  password_env?: string;
  allow_insecure_remote_http?: boolean;
  tls_fingerprint?: string;
  timeout_ms?: number;
};

function loadEnvFiles(): void {
  for (const path of new Set([join(process.cwd(), '.env')])) {
    if (existsSync(path)) process.loadEnvFile(path);
  }
}

function fromRaw(raw: RawProfile, fallbackId: string): RouterProfile {
  if (!raw.url) throw new IptimeError(`Router ${raw.id ?? fallbackId} has no URL`, 'INVALID_CONFIG');
  const baseUrl = new URL(raw.url);
  if (!['http:', 'https:'].includes(baseUrl.protocol)) {
    throw new IptimeError('Router URL must use http or https', 'INVALID_CONFIG');
  }
  if (baseUrl.username || baseUrl.password) {
    throw new IptimeError('Put credentials in environment variables, not in the router URL', 'INVALID_CONFIG');
  }
  baseUrl.pathname = baseUrl.pathname.replace(/\/+$/, '') || '/';
  baseUrl.search = '';
  baseUrl.hash = '';
  const envValue = (name?: string) => name ? process.env[name] : undefined;
  return {
    id: raw.id ?? fallbackId,
    baseUrl,
    username: raw.username ?? envValue(raw.username_env),
    password: raw.password ?? envValue(raw.password_env),
    allowInsecureRemoteHttp: raw.allow_insecure_remote_http ?? false,
    tlsFingerprint: raw.tls_fingerprint?.replaceAll(':', '').toLowerCase(),
    timeoutMs: Math.min(Math.max(raw.timeout_ms ?? 12_000, 1_000), 60_000),
  };
}

export function loadProfiles(): Map<string, RouterProfile> {
  loadEnvFiles();
  let profiles: RouterProfile[];
  if (process.env.IPTIME_ROUTERS) {
    let raws: RawProfile[];
    try {
      raws = JSON.parse(process.env.IPTIME_ROUTERS) as RawProfile[];
    } catch {
      throw new IptimeError('IPTIME_ROUTERS must be a JSON array', 'INVALID_CONFIG');
    }
    if (!Array.isArray(raws)) throw new IptimeError('IPTIME_ROUTERS must be a JSON array', 'INVALID_CONFIG');
    profiles = raws.map((raw, index) => fromRaw(raw, `router-${index + 1}`));
  } else if (process.env.IPTIME_ROUTER_URL) {
    profiles = [fromRaw({
      id: process.env.IPTIME_ROUTER_ID ?? 'default',
      url: process.env.IPTIME_ROUTER_URL,
      username: process.env.IPTIME_ROUTER_USERNAME,
      password: process.env.IPTIME_ROUTER_PASSWORD,
      allow_insecure_remote_http: process.env.IPTIME_ALLOW_INSECURE_REMOTE_HTTP === 'true',
      tls_fingerprint: process.env.IPTIME_TLS_FINGERPRINT,
      timeout_ms: process.env.IPTIME_TIMEOUT_MS ? Number(process.env.IPTIME_TIMEOUT_MS) : undefined,
    }, 'default')];
  } else {
    profiles = [];
  }
  const result = new Map<string, RouterProfile>();
  for (const profile of profiles) {
    if (result.has(profile.id)) throw new IptimeError(`Duplicate router id: ${profile.id}`, 'INVALID_CONFIG');
    result.set(profile.id, profile);
  }
  return result;
}

export function publicProfile(profile: RouterProfile): Record<string, unknown> {
  return {
    id: profile.id,
    url: profile.baseUrl.toString(),
    credentialsConfigured: Boolean(profile.username && profile.password),
    allowInsecureRemoteHttp: profile.allowInsecureRemoteHttp,
    tlsFingerprintConfigured: Boolean(profile.tlsFingerprint),
    timeoutMs: profile.timeoutMs,
  };
}
