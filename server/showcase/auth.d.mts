import type { IncomingMessage } from 'node:http';
export function sameOrigin(request: IncomingMessage): boolean;
export function parseStoryboard(value: unknown): { shots: Array<{ id: string; duration: number }>; duration: number };
