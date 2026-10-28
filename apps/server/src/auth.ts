import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const digest = (value: string) => createHash('sha256').update(value).digest();

// One owner (Leo), one password from the environment, sessions kept in memory:
// a restart asks for the password again.
export function createAuth(
  password: string,
  sessionHours: number,
  secure: boolean,
) {
  const sessions = new Map<string, number>();
  const attempts = new Map<string, { count: number; resetAt: number }>();
  const maxAttempts = 5;
  const windowMs = 60_000;

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
      sessions.set(token, now + sessionHours * 3_600_000);
      return token;
    },
    valid(token: string | undefined, now = Date.now()): boolean {
      if (!token) return false;
      const expires = sessions.get(token);
      if (!expires || expires < now) {
        sessions.delete(token);
        return false;
      }
      return true;
    },
    close(token: string | undefined) {
      if (token) sessions.delete(token);
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
