import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import type { Config } from './config';
import type { Db } from './db/client';
import { registerErrorHandlers } from './errors';
import { authenticatePlugin } from './plugins/authenticate';
import { attachmentRoutes } from './routes/attachments';
import { authRoutes } from './routes/auth';
import { healthRoutes } from './routes/health';
import { pageRoutes } from './routes/pages';
import { spaceRoutes } from './routes/spaces';
import type { Storage } from './storage/storage';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
    storage: Storage;
  }
}

// Лимит JSON-тела запроса; файлы идут отдельными multipart-маршрутами.
const MAX_JSON_BODY_BYTES = 5 * 1024 * 1024;

export const buildApp = (config: Pick<Config, 'NODE_ENV' | 'LOG_LEVEL' | 'JWT_SECRET' | 'AUTH_RATE_LIMIT_MAX'>, db: Db, storage: Storage) => {
  const app = Fastify({
    bodyLimit: MAX_JSON_BODY_BYTES,
    logger: {
      level: config.LOG_LEVEL,
      ...(config.NODE_ENV === 'development' && { transport: { target: 'pino-pretty' } }),
    },
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandlers(app);

  app.decorate('db', db);
  app.decorate('storage', storage);
  app.register(cookie);
  // Лимит включается точечно через `config.rateLimit` у маршрутов.
  app.register(rateLimit, { global: false });
  app.register(authenticatePlugin, { jwtSecret: config.JWT_SECRET });

  app.register(healthRoutes);
  app.register(authRoutes, {
    jwtSecret: config.JWT_SECRET,
    secureCookies: config.NODE_ENV === 'production',
    rateLimitMax: config.AUTH_RATE_LIMIT_MAX,
  });
  app.register(spaceRoutes);
  app.register(pageRoutes);
  app.register(attachmentRoutes);

  return app;
};
