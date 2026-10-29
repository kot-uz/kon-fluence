import axios from 'axios';

// Базовый URL бекенда. Нужен, только когда моки выключены (REACT_APP_DOCS_MOCK=false).
const baseURL = process.env.REACT_APP_API_URL;

if (baseURL) {
  axios.defaults.baseURL = baseURL;
}

// Авторизация: своего логина в приложении нет, но если токен положили
// в localStorage, он будет отправлен.
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt_access_token');
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    } as typeof config.headers;
  }
  return config;
});

export default axios;
