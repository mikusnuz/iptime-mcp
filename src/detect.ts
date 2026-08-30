import { LegacyAdapter } from './adapters/legacy.js';
import { Iux3Adapter } from './adapters/iux3.js';
import type { RouterAdapter } from './adapters/adapter.js';
import { RouterTransport } from './transport.js';

export async function detectAdapter(transport: RouterTransport): Promise<RouterAdapter> {
  try {
    const bootstrap = await transport.text('/ui/flutter_bootstrap.js');
    if (bootstrap.includes('service.cgi')) return new Iux3Adapter(transport);
  } catch {}
  try {
    const hostInfo = await transport.text('/login/hostinfo2.cgi');
    if (/iux|iux_package_installed/i.test(hostInfo)) return new LegacyAdapter(transport, 'mobile-iux');
  } catch {}
  return new LegacyAdapter(transport, 'classic-cgi');
}
