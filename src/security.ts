import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { connect as tlsConnect } from 'node:tls';
import { createHash } from 'node:crypto';
import { IptimeError } from './errors.js';
import type { RouterProfile } from './types.js';

function ipv4Number(address: string): number {
  return address.split('.').reduce((value, part) => (value << 8) + Number(part), 0) >>> 0;
}

function inV4Range(address: string, network: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4Number(address) & mask) === (ipv4Number(network) & mask);
}

export function isPrivateAddress(input: string): boolean {
  const address = input.toLowerCase().replace(/^::ffff:/, '');
  if (isIP(address) === 4) {
    return [
      ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
      ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24],
      ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 4],
    ].some(([network, bits]) => inV4Range(address, String(network), Number(bits)));
  }
  if (isIP(address) === 6) {
    return address === '::1' || address === '::' || address.startsWith('fc') || address.startsWith('fd') ||
      address.startsWith('fe8') || address.startsWith('fe9') || address.startsWith('fea') || address.startsWith('feb');
  }
  return false;
}

export async function resolveTarget(profile: RouterProfile): Promise<{ addresses: string[]; remote: boolean }> {
  const hostname = profile.baseUrl.hostname;
  const addresses = isIP(hostname) ? [hostname] : (await lookup(hostname, { all: true, verbatim: true })).map((x) => x.address);
  if (addresses.length === 0) throw new IptimeError('Router hostname did not resolve', 'DNS_FAILED');
  const remote = addresses.some((address) => !isPrivateAddress(address));
  if (profile.baseUrl.protocol === 'http:' && remote && !profile.allowInsecureRemoteHttp) {
    throw new IptimeError(
      'Refusing to send router traffic over public plain HTTP. Use a LAN/VPN URL, enable HTTPS, or explicitly set IPTIME_ALLOW_INSECURE_REMOTE_HTTP=true.',
      'INSECURE_REMOTE_HTTP',
    );
  }
  return { addresses, remote };
}

export async function verifyTlsFingerprint(profile: RouterProfile): Promise<void> {
  if (profile.baseUrl.protocol !== 'https:' || !profile.tlsFingerprint) return;
  await new Promise<void>((resolve, reject) => {
    const socket = tlsConnect({
      host: profile.baseUrl.hostname,
      port: Number(profile.baseUrl.port || 443),
      servername: isIP(profile.baseUrl.hostname) ? undefined : profile.baseUrl.hostname,
      rejectUnauthorized: true,
      timeout: profile.timeoutMs,
    });
    socket.once('secureConnect', () => {
      const cert = socket.getPeerCertificate(true);
      const actual = createHash('sha256').update(cert.raw).digest('hex');
      socket.end();
      if (actual !== profile.tlsFingerprint) reject(new IptimeError('Router TLS certificate fingerprint changed', 'TLS_FINGERPRINT_MISMATCH'));
      else resolve();
    });
    socket.once('timeout', () => socket.destroy(new IptimeError('TLS check timed out', 'TIMEOUT')));
    socket.once('error', reject);
  });
}

export function safeUrl(base: URL, path: string): URL {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    throw new IptimeError('Invalid router endpoint path', 'INVALID_PATH');
  }
  const url = new URL(path, base);
  if (url.origin !== base.origin) throw new IptimeError('Cross-origin router request blocked', 'CROSS_ORIGIN_BLOCKED');
  return url;
}
