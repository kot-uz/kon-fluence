import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import type { Config } from './config';
import { registerErrorHandlers } from './errors';
import { healthRoutes } from './routes/health';

export const buildApp = (config: Pick<Config, 'NODE_ENV' | 'LOG_LEVEL'>) => {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      ...(config.NODE_ENV === 'development' && { transport: { target: 'pino-pretty' } }),
    },
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandlers(app);

  app.register(healthRoutes);

  return app;
};
