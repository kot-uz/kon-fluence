import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Алиасы `app/...` и `src/app/...` — от них зависят адаптеры модуля документации (src/app/docs/adapters).
const resolvePath = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig(({ mode }) => {
  // Значения по умолчанию обязательны: незаменённый process.env.* упал бы в рантайме.
  const env: Record<string, string> = {
    REACT_APP_API_URL: '',
    ...loadEnv(mode, process.cwd(), 'REACT_APP_'),
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
      Object.entries(env).map(([key, value]) => [`process.env.${key}`, JSON.stringify(value)])
    ),
    server: {
      port: 3010,
      open: true,
    },
    build: {
      outDir: 'build',
      sourcemap: false,
    },
  };
});
