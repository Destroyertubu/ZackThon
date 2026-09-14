import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const hash = value => createHash('sha256').update(String(value)).digest();
export function createAuth(password, now = Date.now) {
  if (typeof password !== 'string' || password.length < 24) throw new Error('Showcase access code is unavailable');
  const sessions = new Map(), attempts = new Map();
  return {
    login(code, ip) {
      let attempt = attempts.get(ip);
      if (!attempt || attempt.until < now()) { attempt = { count: 0, until: now() + 600_000 }; attempts.set(ip, attempt); }
      if (++attempt.count > 10) return { status: 429 };
      if (!timingSafeEqual(hash(code), hash(password))) return { status: 401 };
      const token = randomBytes(32).toString('base64url');
      sessions.set(hash(token).toString('hex'), now() + 7_200_000);
      return { status: 200, token };
    },
    authorized(cookie = '') {
      const token = cookie.match(/(?:^|;\s*)wanderwise_showcase=([^;]+)/)?.[1];
      if (!token) return false;
      const key = hash(token).toString('hex'), expires = sessions.get(key);
      if (!expires || expires <= now()) { sessions.delete(key); return false; }
      return true;
    },
    sweep() {
      for (const [key, expires] of sessions) if (expires <= now()) sessions.delete(key);
      for (const [key, attempt] of attempts) if (attempt.until <= now()) attempts.delete(key);
    },
  };
}

export function sameOrigin(request) {
  return request.headers.origin === `${request.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'}://${request.headers.host}`;
}

export function parseStoryboard(value) {
  if (!value || !Array.isArray(value.shots) || !value.shots.length || value.shots.length > 20) throw new Error('Storyboard has no valid shots');
  const ids = new Set();
  const shots = value.shots.map(shot => {
    const duration = Number(shot.duration ?? shot.durationSeconds ?? shot.seconds);
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(shot.id) || ids.has(shot.id) || !Number.isFinite(duration) || duration < 1 || duration > 120) throw new Error('Invalid storyboard shot');
    ids.add(shot.id);
    return { id: shot.id, duration };
  });
  return { shots, duration: shots.reduce((total, shot) => total + shot.duration, 0) };
}
