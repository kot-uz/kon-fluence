import httpClient from 'app/helpers/httpClient';

export const ACCESS_TOKEN_KEY = 'jwt_access_token';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
}

interface Session {
  accessToken: string;
  user: AuthUser;
}

export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
}

export const saveAccessToken = (token: string) => {
  try {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } catch {
    // приватный режим браузера — сохранять некуда, запросы уйдут без токена
  }
};

export const login = async (email: string, password: string) => {
  const { data } = await httpClient.post<Session>('/auth/login', { email, password });
  saveAccessToken(data.accessToken);
  return data.user;
};

export const register = async (payload: RegisterPayload) => {
  const { data } = await httpClient.post<Session>('/auth/register', payload);
  saveAccessToken(data.accessToken);
  return data.user;
};

export const clearAccessToken = () => {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    // нечего чистить
  }
};

export const hasAccessToken = () => {
  try {
    return Boolean(localStorage.getItem(ACCESS_TOKEN_KEY));
  } catch {
    return false;
  }
};

export const logout = async () => {
  try {
    await httpClient.post('/auth/logout');
  } finally {
    // токен убираем, даже если сервер недоступен
    clearAccessToken();
  }
};
