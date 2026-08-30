import type { InterfaceKind, JsonObject, JsonValue, ProbeResult } from '../types.js';

export interface RouterAdapter {
  readonly kind: InterfaceKind;
  probe(): Promise<ProbeResult>;
  login(captchaCode?: string): Promise<JsonValue>;
  logout(): Promise<void>;
  call(method: string, params?: JsonObject | JsonValue): Promise<JsonValue>;
  has(method: string): Promise<boolean | undefined>;
}
