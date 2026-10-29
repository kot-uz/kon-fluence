import type { BaseQueryApi } from '@reduxjs/toolkit/query';
import type { RtkQueryArgs } from '../adapters/transport';
import { docsBaseQuery } from './docsBaseQuery';

/**
 * Ответ queryFn в форме RTK Query: либо данные, либо ошибка.
 * Свой тип, потому что QueryReturnValue из @reduxjs/toolkit наружу не экспортируется.
 */
type QueryResult<Result> =
  | { data: Result; error?: undefined }
  | { data?: undefined; error: unknown };

// Эндпоинты используют собственный baseQuery (локальный или /docs) через queryFn,
// поэтому не зависят от baseQuery хост-API.
export const request =
  <Arg, Result>(buildArgs: (arg: Arg) => RtkQueryArgs) =>
  async (arg: Arg, api: BaseQueryApi, extraOptions: object) =>
    // форму ответа задаёт сам эндпоинт: baseQuery отдаёт данные как unknown
    (await docsBaseQuery(buildArgs(arg), api, extraOptions)) as QueryResult<Result>;
