import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { loadConfig } from '../config';
import { createDb } from './client';

const { db, pool } = createDb(loadConfig().DATABASE_URL);

migrate(db, { migrationsFolder: new URL('../../drizzle', import.meta.url).pathname })
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
