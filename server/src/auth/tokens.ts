import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const signAccessToken = (secret: string, userId: string) =>
  new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .sign(new TextEncoder().encode(secret));

/** Возвращает id пользователя или null, если токен недействителен или просрочен. */
export const verifyAccessToken = async (secret: string, token: string): Promise<string | null> => {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'] });
    return payload.sub ?? null;
  } catch {
    return null;
  }
};

export const generateRefreshToken = () => randomBytes(32).toString('base64url');

// Refresh-токен случайный и длинный, поэтому достаточно быстрого хэша без соли.
export const hashRefreshToken = (token: string) => createHash('sha256').update(token).digest('hex');
