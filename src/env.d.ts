/// <reference types="vite/client" />

// Переменные REACT_APP_* подставляет vite.config.ts через define — в коде они читаются
// как process.env.REACT_APP_*.
declare namespace NodeJS {
  interface ProcessEnv {
    readonly REACT_APP_API_URL: string;
  }
}
