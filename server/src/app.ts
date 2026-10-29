import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import type { Config } from './config';
import type { Db } from './db/client';
import { registerErrorHandlers } from './errors';
import { authenticatePlugin } from './plugins/authenticate';
import { authRoutes } from './routes/auth';
import { healthRoutes } from './routes/health';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
  }
}

export const buildApp = (config: Pick<Config, 'NODE_ENV' | 'LOG_LEVEL' | 'JWT_SECRET' | 'AUTH_RATE_LIMIT_MAX'>, db: Db) => {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      ...(config.NODE_ENV === 'development' && { transport: { target: 'pino-pretty' } }),
    },
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandlers(app);

  app.decorate('db', db);
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

  return app;
};
