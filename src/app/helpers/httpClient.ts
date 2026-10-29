import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';
import { readStorageMode } from 'app/store/storageModeSlice';

// Базовый URL бекенда. Нужен только для облачного режима.
const baseURL = process.env.REACT_APP_API_URL;

if (baseURL) {
  axios.defaults.baseURL = baseURL;
  // refresh-токен лежит в httpOnly-cookie
  axios.defaults.withCredentials = true;
}

const ACCESS_TOKEN_KEY = 'jwt_access_token';

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    } as typeof config.headers;
  }
  return config;
});

type RetriableConfig = AxiosRequestConfig & { _retried?: boolean };

/** Запросы самой авторизации не повторяются: 401 на них значит неверные данные или конец сессии. */
const isAuthUrl = (url?: string) => /\/auth\/(login|register|refresh|logout)/.test(url ?? '');

// Один refresh на все одновременно упавшие запросы.
let refreshing: Promise<string> | null = null;

const refreshAccessToken = () => {
  refreshing ??= axios
    .post<{ accessToken: string }>('/auth/refresh')
    .then(({ data }) => {
      localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
      return data.accessToken;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
};

axios.interceptors.response.use(undefined, async (error) => {
  const config = error.config as RetriableConfig | undefined;
  if (
    error.response?.status !== 401 ||
    !config ||
    config._retried ||
    isAuthUrl(config.url) ||
    readStorageMode() !== 'cloud'
  ) {
    return Promise.reject(error);
  }

  config._retried = true;
  try {
    const token = await refreshAccessToken();
    config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
    return axios(config);
  } catch {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    if (window.location.pathname !== '/login') window.location.assign('/login');
    return Promise.reject(error);
  }
});

export default axios;
