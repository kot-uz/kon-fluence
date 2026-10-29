import { and, eq, isNull } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import type { Db } from '../db/client';
import { refreshTokens } from '../db/schema';
import { REFRESH_TTL_MS, generateRefreshToken, hashRefreshToken } from './tokens';

export const REFRESH_COOKIE = 'refresh_token';
const COOKIE_PATH = '/auth';

type Executor = Pick<Db, 'insert' | 'update' | 'select'>;

/** Создаёт refresh-токен в цепочке `familyId` (новой, если не передана) и возвращает его открытое значение. */
export const issueRefreshToken = async (db: Executor, userId: string, familyId: string = randomUUID()) => {
  const token = generateRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  await db.insert(refreshTokens).values({ userId, familyId, tokenHash: hashRefreshToken(token), expiresAt });
  return { token, expiresAt };
};

export const revokeFamily = (db: Executor, familyId: string) =>
  db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));

export const revokeAllForUser = (db: Executor, userId: string) =>
  db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));

export const setRefreshCookie = (reply: FastifyReply, token: string, expiresAt: Date, secure: boolean) => {
  reply.setCookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: COOKIE_PATH,
    expires: expiresAt,
  });
};

export const clearRefreshCookie = (reply: FastifyReply) => {
  reply.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
};

export const readRefreshCookie = (request: FastifyRequest): string | undefined => request.cookies[REFRESH_COOKIE];
