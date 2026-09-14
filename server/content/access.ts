import { createHmac, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';

export interface AccessConfig { version: 1; cookieSecret: string }
export function loadAccessConfig(path: string): AccessConfig {
  if (existsSync(path)) {
    const config = JSON.parse(readFileSync(path, 'utf8')) as AccessConfig;
    if (config.version !== 1 || typeof config.cookieSecret !== 'string' || config.cookieSecret.length < 32) throw new Error('Invalid local access configuration');
    chmodSync(path, 0o600);
    // Preserve the existing visitor signature; legacy invite codes are no longer read.
    return { version: 1, cookieSecret: config.cookieSecret };
  }
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const config: AccessConfig = { version: 1, cookieSecret: randomBytes(32).toString('hex') };
  writeFileSync(path, JSON.stringify(config, null, 2), { mode: 0o600, flag: 'wx' });
  return config;
}
export function cookies(value = ''): Record<string, string> {
  return Object.fromEntries(value.split(';').flatMap((part) => {
    const match = /^\s*([a-zA-Z0-9_-]+)=([^;]*)$/.exec(part);
    return match ? [[match[1], match[2]]] : [];
  }));
}
export class AccessService {
  constructor(private readonly config: AccessConfig) {}
  visitor(cookie?: string): { id: string; cookie?: string } {
    const [id, signature] = (cookie ?? '').split('.');
    if (id && /^[a-f0-9]{32}$/.test(id) && signature === this.sign(id)) return { id };
    const next = randomBytes(16).toString('hex');
    return { id: next, cookie: `${next}.${this.sign(next)}` };
  }
  private sign(id: string) { return createHmac('sha256', this.config.cookieSecret).update(id).digest('hex'); }
}
