import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, isAbsolute } from 'node:path';
import { ApiError } from '../galaxy/zhihu.js';

export const defaultCliPath = join(homedir(), 'Library/Application Support/zhihu-cli/current/zhihu-cli');
export type CliRunner = (args: string[], timeoutMs?: number) => Promise<unknown>;

/** The caller selects a fixed public command; untrusted values occupy argument values only. */
export function createCliRunner(path = process.env.ZHIHU_CLI_PATH || defaultCliPath): CliRunner {
  if (!isAbsolute(path)) throw new Error('ZHIHU_CLI_PATH must be absolute');
  return (args, timeoutMs = 25_000) => new Promise((resolve, reject) => {
    if (!existsSync(path)) return reject(new ApiError(503, 'ZHIHU_CLI_UNAVAILABLE', '服务端尚未连接知乎 CLI，精选内容仍可使用。'));
    execFile(path, [...args, '--timeout', `${Math.ceil(timeoutMs / 1000)}s`], {
      timeout: timeoutMs + 1000, maxBuffer: 4_000_000, encoding: 'utf8', shell: false,
    }, (error, stdout) => {
      let raw: unknown;
      try { raw = JSON.parse(stdout); } catch {
        return reject(new ApiError(error?.killed ? 504 : 502, error?.killed ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE', error?.killed ? '知乎接口响应超时，请稍后重试。' : '知乎 CLI 暂时无法读取内容。'));
      }
      const payload = raw as { Code?: number; ok?: boolean; error?: { code?: string } };
      if (error || payload.ok === false || (payload.Code !== undefined && payload.Code !== 0)) {
        const code = String(payload.Code ?? payload.error?.code ?? '');
        if (/30001|429|RATE|QUOTA/i.test(code)) return reject(new ApiError(429, 'ZHIHU_RATE_LIMITED', '知乎接口额度或频率已受限，请稍后重试。'));
        if (/20001|401|403|AUTH|CREDENTIAL/i.test(code)) return reject(new ApiError(503, 'ZHIHU_AUTH_FAILED', '知乎 CLI 的认证或应用权限不可用，请在服务端检查。'));
        return reject(new ApiError(502, 'UPSTREAM_INVALID_RESPONSE', '知乎接口未能完成本次请求。'));
      }
      resolve(raw);
    });
  });
}
