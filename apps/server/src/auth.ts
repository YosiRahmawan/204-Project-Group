import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const digest = (value: string) => createHash('sha256').update(value).digest();
const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

// Where sessions live. The server keeps them in its database, so a restart does not log Leo out.
export type SessionStore = {
  put(hash: string, expiresAt: number): void;
  expiry(hash: string): number | undefined;
  remove(hash: string): void;
  purge(now: number): void;
};

// One owner (Leo) with one password from the environment.
export function createAuth(
  password: string,
  sessionHours: number,
  secure: boolean,
  sessions: SessionStore,
) {
  const attempts = new Map<string, { count: number; resetAt: number }>();
  const maxAttempts = 5;
  const windowMs = 60_000;
  sessions.purge(Date.now());

  return {
    // 'limited' after too many wrong passwords from one address in a minute.
    login(
      candidate: string,
      address: string,
      now = Date.now(),
    ): 'ok' | 'bad' | 'limited' {
      const record = attempts.get(address);
      const current =
        record && record.resetAt > now
          ? record
          : { count: 0, resetAt: now + windowMs };
      if (current.count >= maxAttempts) return 'limited';
      attempts.set(address, current);
      // Hashing first makes both sides the same length for a constant-time comparison.
      if (!timingSafeEqual(digest(candidate), digest(password))) {
        current.count++;
        return 'bad';
      }
      attempts.delete(address);
      return 'ok';
    },
    open(now = Date.now()): string {
      const token = randomBytes(32).toString('hex');
      sessions.put(hashToken(token), now + sessionHours * 3_600_000);
      return token;
    },
    valid(token: string | undefined, now = Date.now()): boolean {
      if (!token) return false;
      const hash = hashToken(token);
      const expires = sessions.expiry(hash);
      if (expires === undefined || expires < now) {
        sessions.remove(hash);
        return false;
      }
      return true;
    },
    close(token: string | undefined) {
      if (token) sessions.remove(hashToken(token));
    },
    cookie(token: string): string {
      return `session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionHours * 3600}${secure ? '; Secure' : ''}`;
    },
    clearCookie(): string {
      return `session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure ? '; Secure' : ''}`;
    },
  };
}

export function sessionToken(
  cookieHeader: string | undefined,
): string | undefined {
  return cookieHeader
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('session='))
    ?.slice('session='.length);
}
