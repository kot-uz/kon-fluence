import type { FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { verifyAccessToken } from '../auth/tokens';
import { AppError } from '../errors';

declare module 'fastify' {
  interface FastifyInstance {
    /** preHandler: требует валидный access-токен и кладёт id пользователя в `request.userId`. */
    authenticate: (request: FastifyRequest) => Promise<void>;
  }
  interface FastifyRequest {
    userId: string;
  }
}

interface Options {
  jwtSecret: string;
}

export const authenticatePlugin = fp<Options>(async (app, { jwtSecret }) => {
  app.decorateRequest('userId', '');

  app.decorate('authenticate', async (request: FastifyRequest) => {
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
    const userId = token ? await verifyAccessToken(jwtSecret, token) : null;
    if (!userId) throw new AppError(401, 'UNAUTHORIZED', 'Требуется вход в аккаунт');
    request.userId = userId;
  });
});
