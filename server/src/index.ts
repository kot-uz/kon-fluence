import { buildApp } from './app';
import { loadConfig } from './config';

const config = loadConfig();
const app = buildApp(config);

app.listen({ host: config.HOST, port: config.PORT }).catch((err) => {
  app.log.fatal({ err }, 'не удалось запустить сервер');
  process.exit(1);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    app.close().then(() => process.exit(0));
  });
}
