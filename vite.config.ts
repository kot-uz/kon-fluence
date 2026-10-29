import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Алиасы `app/...` и `src/app/...` — от них зависят адаптеры модуля документации (src/app/docs/adapters).
const resolvePath = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig(({ mode }) => {
  // Значения по умолчанию обязательны: незаменённый process.env.* упал бы в рантайме.
  const env: Record<string, string> = {
    REACT_APP_API_URL: '',
    DEV_API_PROXY_TARGET: 'http://localhost:3000',
    ...loadEnv(mode, process.cwd(), ['REACT_APP_', 'DEV_']),
  };

  return {
    plugins: [react()],
    resolve: {
      alias: {
        app: resolvePath('./src/app'),
        src: resolvePath('./src'),
      },
    },
    // Модуль документации читает process.env.REACT_APP_* — отдаём эти значения явно,
    // объект process.env целиком не подменяем, чтобы не ломать зависимости.
    define: Object.fromEntries(
      Object.entries(env)
        .filter(([key]) => key.startsWith('REACT_APP_'))
        .map(([key, value]) => [`process.env.${key}`, JSON.stringify(value)])
    ),
    server: {
      port: 3010,
      open: true,
      // запросы к API идут через dev-сервер, чтобы refresh-cookie оставалась на одном origin
      proxy: Object.fromEntries(
        ['/docs', '/auth'].map((prefix) => [
          prefix,
          {
            target: env.DEV_API_PROXY_TARGET,
            changeOrigin: true,
            // /docs занят и роутами приложения: переходы браузера отдаём SPA, а не бекенду
            bypass: (req: { headers: { accept?: string }; url?: string }) =>
              req.headers.accept?.includes('text/html') ? req.url : undefined,
          },
        ])
      ),
    },
    build: {
      outDir: 'build',
      sourcemap: false,
    },
  };
});
