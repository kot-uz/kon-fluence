import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { hashPassword, verifyDummyPassword, verifyPassword } from '../auth/password';
import {
  clearRefreshCookie,
  issueRefreshToken,
  readRefreshCookie,
  revokeAllForUser,
  revokeFamily,
  setRefreshCookie,
} from '../auth/refresh';
import { emailSchema, fullNameSchema, passwordSchema, sessionSchema, toPublicUser, userSchema } from '../auth/schemas';
import { hashRefreshToken, signAccessToken } from '../auth/tokens';
import { refreshTokens, users } from '../db/schema';
import { AppError } from '../errors';

interface Options {
  jwtSecret: string;
  secureCookies: boolean;
  rateLimitMax: number;
}

const UNIQUE_VIOLATION = '23505';
const invalidCredentials = () => new AppError(401, 'INVALID_CREDENTIALS', 'Неверный email или пароль');
const invalidSession = () => new AppError(401, 'INVALID_REFRESH_TOKEN', 'Сессия недействительна, войдите заново');

export const authRoutes = async (rawApp: FastifyInstance, { jwtSecret, secureCookies, rateLimitMax }: Options) => {
  const app = rawApp.withTypeProvider<ZodTypeProvider>();
  const { db } = app;
  const limit = { rateLimit: { max: rateLimitMax, timeWindow: '1 minute' } };

  /** Создаёт новую сессию: кладёт refresh в cookie и возвращает ответ с access-токеном. */
  const startSession = async (reply: Parameters<typeof setRefreshCookie>[0], user: typeof users.$inferSelect) => {
    const refresh = await issueRefreshToken(db, user.id);
    setRefreshCookie(reply, refresh.token, refresh.expiresAt, secureCookies);
    return { accessToken: await signAccessToken(jwtSecret, user.id), user: toPublicUser(user) };
  };

  app.post(
    '/auth/register',
    {
      config: limit,
      schema: {
        body: z.object({ email: emailSchema, password: passwordSchema, fullName: fullNameSchema }),
        response: { 201: sessionSchema },
      },
    },
    async (request, reply) => {
      const { email, password, fullName } = request.body;
      const passwordHash = await hashPassword(password);
      const [user] = await db
        .insert(users)
        .values({ email, passwordHash, fullName })
        .returning()
        .catch((err: { code?: string; cause?: { code?: string } }) => {
          // drizzle оборачивает ошибку драйвера в `cause`.
          if ((err.cause?.code ?? err.code) === UNIQUE_VIOLATION) throw new AppError(409, 'EMAIL_TAKEN', 'Этот email уже зарегистрирован');
          throw err;
        });
      return reply.code(201).send(await startSession(reply, user));
    }
  );

  app.post(
    '/auth/login',
    {
      config: limit,
      schema: {
        body: z.object({ email: emailSchema, password: z.string().min(1).max(128) }),
        response: { 200: sessionSchema },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;
      const [user] = await db.select().from(users).where(eq(users.email, email));
      if (!user) {
        await verifyDummyPassword(password);
        throw invalidCredentials();
      }
      if (!(await verifyPassword(user.passwordHash, password))) throw invalidCredentials();
      return startSession(reply, user);
    }
  );

  app.post(
    '/auth/refresh',
    { config: limit, schema: { response: { 200: sessionSchema } } },
    async (request, reply) => {
      const token = readRefreshCookie(request);
      if (!token) throw invalidSession();

      const result = await db.transaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(refreshTokens)
          .where(eq(refreshTokens.tokenHash, hashRefreshToken(token)))
          .for('update');
        if (!row) return { status: 'invalid' as const };
        // Повторное использование уже погашенного токена: считаем его украденным и отзываем всю цепочку.
        if (row.revokedAt) {
          await revokeFamily(tx, row.familyId);
          return { status: 'reused' as const };
        }
        if (row.expiresAt <= new Date()) return { status: 'invalid' as const };

        await tx.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, row.id));
        const [user] = await tx.select().from(users).where(eq(users.id, row.userId));
        const next = await issueRefreshToken(tx, row.userId, row.familyId);
        return { status: 'ok' as const, user, next };
      });

      if (result.status !== 'ok') {
        clearRefreshCookie(reply);
        throw invalidSession();
      }
      setRefreshCookie(reply, result.next.token, result.next.expiresAt, secureCookies);
      return { accessToken: await signAccessToken(jwtSecret, result.user.id), user: toPublicUser(result.user) };
    }
  );

  app.post('/auth/logout', async (request, reply) => {
    const token = readRefreshCookie(request);
    if (token) {
      const [row] = await db
        .select({ familyId: refreshTokens.familyId })
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, hashRefreshToken(token)));
      if (row) await revokeFamily(db, row.familyId);
    }
    clearRefreshCookie(reply);
    return reply.code(204).send();
  });

  app.get(
    '/auth/me',
    { preHandler: app.authenticate, schema: { response: { 200: userSchema } } },
    async (request) => {
      const [user] = await db.select().from(users).where(eq(users.id, request.userId));
      // Токен выпущен для удалённого пользователя.
      if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Требуется вход в аккаунт');
      return toPublicUser(user);
    }
  );

  app.patch(
    '/auth/me',
    {
      preHandler: app.authenticate,
      config: limit,
      schema: {
        body: z
          .object({
            fullName: fullNameSchema.optional(),
            currentPassword: z.string().min(1).max(128).optional(),
            newPassword: passwordSchema.optional(),
          })
          .refine((b) => !b.newPassword || b.currentPassword, {
            message: 'Для смены пароля укажите текущий пароль',
            path: ['currentPassword'],
          }),
        response: { 200: z.object({ user: userSchema, accessToken: z.string().optional() }) },
      },
    },
    async (request, reply) => {
      const { fullName, currentPassword, newPassword } = request.body;
      const [user] = await db.select().from(users).where(eq(users.id, request.userId));
      if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Требуется вход в аккаунт');

      const patch: Partial<typeof users.$inferInsert> = {};
      if (fullName) patch.fullName = fullName;
      if (newPassword) {
        if (!(await verifyPassword(user.passwordHash, currentPassword!))) {
          throw new AppError(403, 'INVALID_PASSWORD', 'Неверный текущий пароль');
        }
        patch.passwordHash = await hashPassword(newPassword);
      }

      const updated = Object.keys(patch).length
        ? (await db.update(users).set(patch).where(eq(users.id, user.id)).returning())[0]
        : user;

      if (!newPassword) return { user: toPublicUser(updated) };

      // Смена пароля завершает все сессии; текущая продолжается с новой цепочкой токенов.
      const refresh = await db.transaction(async (tx) => {
        await revokeAllForUser(tx, user.id);
        return issueRefreshToken(tx, user.id);
      });
      setRefreshCookie(reply, refresh.token, refresh.expiresAt, secureCookies);
      return { user: toPublicUser(updated), accessToken: await signAccessToken(jwtSecret, user.id) };
    }
  );
};
