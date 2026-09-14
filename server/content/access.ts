import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { ApiError } from '../galaxy/zhihu.js';
import { ContentStore, digest } from './store.js';

export interface AccessConfig { version: 1; cookieSecret: string; inviteCodes: string[] }
export function loadAccessConfig(path: string): AccessConfig {
  if (existsSync(path)) {
    const config = JSON.parse(readFileSync(path, 'utf8')) as AccessConfig;
    if (config.version !== 1 || typeof config.cookieSecret !== 'string' || config.cookieSecret.length < 32 || !Array.isArray(config.inviteCodes) || !config.inviteCodes.length || config.inviteCodes.some((value) => typeof value !== 'string' || value.length < 16)) throw new Error('Invalid local access configuration');
    chmodSync(path, 0o600);
    return config;
  }
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const config: AccessConfig = { version: 1, cookieSecret: randomBytes(32).toString('hex'), inviteCodes: [`mirror-${randomBytes(18).toString('base64url')}`] };
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
  constructor(private readonly store: ContentStore, private readonly config: AccessConfig, private readonly now = Date.now) {}
  visitor(cookie?: string): { id: string; cookie?: string } {
    const [id, signature] = (cookie ?? '').split('.');
    if (id && /^[a-f0-9]{32}$/.test(id) && signature === this.sign(id)) return { id };
    const next = randomBytes(16).toString('hex');
    return { id: next, cookie: `${next}.${this.sign(next)}` };
  }
  private sign(id: string) { return createHmac('sha256', this.config.cookieSecret).update(id).digest('hex'); }
  authorize(token?: string): string {
    if (!token || !/^[a-zA-Z0-9_-]{43}$/.test(token)) throw new ApiError(401, 'ACCESS_REQUIRED', '请输入访问码后使用 AI 合成。');
    const actor = this.store.session(token);
    if (!actor) throw new ApiError(401, 'ACCESS_EXPIRED', 'AI 会话已过期，请重新输入访问码。');
    return actor;
  }
  exchange(code: unknown): { token: string; expiresAt: number } {
    if (typeof code !== 'string' || code.length > 200) throw new ApiError(401, 'INVALID_ACCESS_CODE', '访问码无效。');
    const hash = digest(code.trim());
    const matched = this.config.inviteCodes.find((value) => timingSafeEqual(Buffer.from(digest(value)), Buffer.from(hash)));
    if (!matched) throw new ApiError(401, 'INVALID_ACCESS_CODE', '访问码无效。');
    const token = randomBytes(32).toString('base64url');
    const expiresAt = this.now() + 2 * 60 * 60_000;
    this.store.issueSession(token, digest(matched), expiresAt);
    return { token, expiresAt };
  }
}
