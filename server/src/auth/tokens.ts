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
    // токены с audience (подписанные ссылки на файлы) не дают доступа к API
    return payload.aud ? null : (payload.sub ?? null);
  } catch {
    return null;
  }
};

export const generateRefreshToken = () => randomBytes(32).toString('base64url');

// Refresh-токен случайный и длинный, поэтому достаточно быстрого хэша без соли.
export const hashRefreshToken = (token: string) => createHash('sha256').update(token).digest('hex');

export const MEDIA_TTL_SECONDS = 60 * 60;
const MEDIA_AUDIENCE = 'attachment';

/** Короткоживущий токен для `?token=` в ссылке на содержимое одного вложения. */
export const signMediaToken = (secret: string, attachmentId: string) =>
  new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(attachmentId)
    .setAudience(MEDIA_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${MEDIA_TTL_SECONDS}s`)
    .sign(new TextEncoder().encode(secret));

/** Возвращает id вложения из токена или null, если токен недействителен, просрочен или не медиа. */
export const verifyMediaToken = async (secret: string, token: string): Promise<string | null> => {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ['HS256'],
      audience: MEDIA_AUDIENCE,
    });
    return payload.sub ?? null;
  } catch {
    return null;
  }
};
