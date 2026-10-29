import { buildApp } from './app';
import { loadConfig } from './config';
import { createDb } from './db/client';
import { cleanupExpiredImports } from './docs/import-cleanup';
import { createS3Storage } from './storage/s3';

const config = loadConfig();
const { db, pool } = createDb(config.DATABASE_URL);
const storage = createS3Storage(config);
const app = buildApp(config, db, storage);

// Незавершённые сессии импорта живут 24 часа; просроченные чистим раз в час.
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const cleanupTimer = setInterval(() => {
  cleanupExpiredImports(db, storage).catch((err) => app.log.error({ err }, 'не удалось очистить сессии импорта'));
}, CLEANUP_INTERVAL_MS);
cleanupTimer.unref();

app.listen({ host: config.HOST, port: config.PORT }).catch((err) => {
  app.log.fatal({ err }, 'не удалось запустить сервер');
  process.exit(1);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    clearInterval(cleanupTimer);
    app
      .close()
      .then(() => pool.end())
      .then(() => process.exit(0));
  });
}
