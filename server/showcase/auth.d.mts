import type { IncomingMessage } from 'node:http';
export function createAuth(password: string | undefined, now?: () => number): {
  login(code: string, ip: string): { status: number; token?: string };
  authorized(cookie?: string): boolean;
  sweep(): void;
};
export function sameOrigin(request: IncomingMessage): boolean;
export function parseStoryboard(value: unknown): { shots: Array<{ id: string; duration: number }>; duration: number };
