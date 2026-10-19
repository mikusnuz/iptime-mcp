function isSecretKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  return /(?:password|passwd|passphrase|secret|token|session|captcha|privatekey|presharedkey|apikey|authkey|wpakey|wpapsk|psk|cookie)/.test(normalized) || normalized === 'pass' || normalized === 'pw' || normalized === 'key';
}

export function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 20) return '[truncated]';
  if (Array.isArray(value)) return value.map((item) => sanitize(item, depth + 1));
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      result[key] = isSecretKey(key) ? '[redacted]' : sanitize(item, depth + 1);
    }
    return result;
  }
  if (typeof value === 'string' && value.length > 200_000) return `${value.slice(0, 200_000)}…`;
  return value;
}
