import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  // Лимит запросов в минуту с одного IP на register/login/refresh.
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
});

export type Config = z.infer<typeof schema>;

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => {
  const result = schema.safeParse(env);
  if (!result.success) {
    throw new Error(`Некорректные переменные окружения: ${z.prettifyError(result.error)}`);
  }
  return result.data;
};
