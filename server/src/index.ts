import { buildApp } from './app';
import { loadConfig } from './config';
import { createDb } from './db/client';
import { createS3Storage } from './storage/s3';

const config = loadConfig();
const { db, pool } = createDb(config.DATABASE_URL);
const app = buildApp(config, db, createS3Storage(config));

app.listen({ host: config.HOST, port: config.PORT }).catch((err) => {
  app.log.fatal({ err }, 'не удалось запустить сервер');
  process.exit(1);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    app
      .close()
      .then(() => pool.end())
      .then(() => process.exit(0));
  });
}
