export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export type InterfaceKind = 'iux3' | 'mobile-iux' | 'classic-cgi' | 'unknown';
export type Risk = 'read' | 'reversible' | 'connectivity' | 'critical';
export type CapabilityState = 'full' | 'read_only' | 'unsupported' | 'unknown';

export interface RouterProfile {
  id: string;
  baseUrl: URL;
  username?: string;
  password?: string;
  allowInsecureRemoteHttp: boolean;
  tlsFingerprint?: string;
  timeoutMs: number;
}

export interface ProbeResult {
  interface: InterfaceKind;
  reachable: boolean;
  authenticated: boolean;
  product?: JsonValue;
  system?: JsonValue;
  reason?: string;
}

export interface Capability {
  operation: string;
  domain: string;
  mode: 'read' | 'write';
  risk: Risk;
  state: CapabilityState;
  method?: string;
  interface: InterfaceKind;
}

export interface ChangePlan {
  id: string;
  routerId: string;
  operation: string;
  method: string;
  params?: JsonValue;
  risk: Exclude<Risk, 'read'>;
  before?: JsonValue;
  createdAt: string;
  expiresAt: string;
  state: 'pending' | 'applied' | 'cancelled' | 'expired' | 'failed';
  digest: string;
  result?: JsonValue;
  verification?: JsonValue;
  attachment?: {
    path: string;
    sha256: string;
    size: number;
    kind: 'firmware' | 'configuration';
  };
}
