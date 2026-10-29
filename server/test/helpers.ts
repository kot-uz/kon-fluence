import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { createDb } from '../src/db/client';

export const JWT_SECRET = 'test-secret-0123456789abcdef0123456789';

export interface TestEnv {
  app: FastifyInstance;
  db: ReturnType<typeof createDb>['db'];
  close: () => Promise<void>;
}

/** Поднимает Postgres в контейнере, применяет миграции и собирает приложение. */
export const createTestEnv = async (
  options: { rateLimitMax?: number; setup?: (app: FastifyInstance) => void } = {}
): Promise<TestEnv> => {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer('postgres:16-alpine').start();
  const { db, pool } = createDb(container.getConnectionUri());
  await migrate(db, { migrationsFolder: new URL('../drizzle', import.meta.url).pathname });

  const app = buildApp(
    { NODE_ENV: 'test', LOG_LEVEL: 'silent', JWT_SECRET, AUTH_RATE_LIMIT_MAX: options.rateLimitMax ?? 1000 },
    db
  );
  options.setup?.(app);
  await app.ready();

  return {
    app,
    db,
    close: async () => {
      await app.close();
      await pool.end();
      await container.stop();
    },
  };
};

export const cookieValue = (res: { cookies: { name: string; value: string }[] }, name = 'refresh_token') =>
  res.cookies.find((c) => c.name === name)?.value;
