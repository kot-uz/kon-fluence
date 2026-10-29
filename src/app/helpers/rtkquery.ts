import axios from 'axios';
import type { AxiosError, AxiosRequestConfig, Method } from 'axios';
import type { BaseQueryFn } from '@reduxjs/toolkit/query';

/** Аргументы запроса: либо сам URL, либо объект с методом, телом и параметрами. */
export interface RtkQueryArgs {
  url: string;
  method?: Method;
  body?: unknown;
  params?: AxiosRequestConfig['params'];
  responseType?: AxiosRequestConfig['responseType'];
  headers?: AxiosRequestConfig['headers'];
}

/** Ошибка запроса в форме, которую ожидает RTK Query. */
export interface RtkQueryError {
  status?: number;
  data?: unknown;
}

/** baseQuery документации: мок или реальный axios-запрос. */
export type DocsBaseQuery = BaseQueryFn<RtkQueryArgs | string, unknown, RtkQueryError>;

/**
 * baseQuery на axios.
 * Используется, только когда моки выключены (REACT_APP_DOCS_MOCK=false).
 */
export const rtkBaseQuery =
  (basePath = ''): DocsBaseQuery =>
  async (args) => {
    const normalized: RtkQueryArgs = typeof args === 'string' ? { url: args, method: 'GET' } : args;
    const { method = 'get', body, params, responseType, headers } = normalized;
    let { url } = normalized;

    if (basePath && url && !url.startsWith(basePath)) {
      url = `${basePath.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
    }

    try {
      const result = await axios.request({
        url,
        method,
        data: body,
        params,
        headers,
        ...(responseType ? { responseType } : {}),
      });
      return { data: result.data };
    } catch (error) {
      const axiosError = error as AxiosError;
      return {
        error: {
          status: axiosError.response?.status,
          data: axiosError.response?.data,
        },
      };
    }
  };

export const urlWithSearchParams = (url: string, params: Record<string, string>) =>
  `${url}?${new URLSearchParams(params).toString()}`;
