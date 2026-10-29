import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';

/**
 * Пустой createApi, в который модуль документации инжектит свои эндпоинты
 * (см. src/app/docs/api/docsApi.ts). baseQuery фиктивный: каждый эндпоинт
 * документации использует собственный docsBaseQuery через queryFn.
 */
export const docsHostApi = createApi({
  reducerPath: 'docsApi',
  baseQuery: fakeBaseQuery<unknown>(),
  endpoints: () => ({}),
});

export default docsHostApi;
