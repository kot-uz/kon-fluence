import type { BaseQueryApi } from '@reduxjs/toolkit/query';
import { hostApi } from '../adapters/transport';
import type { RtkQueryArgs } from '../adapters/transport';
import { setTaskChecked } from '../utils/tasks';
import type { DocContent, DocsPage, DocsTreeItem, SpaceType } from '../types';
import { docsBaseQuery } from './docsBaseQuery';

/** Пространство, чьё дерево страниц запрашивается. */
export interface DocsSpaceArgs {
  spaceType: SpaceType;
  spaceId: string;
}

export interface GetDocsPageArgs {
  id: string;
}

export interface CreateDocsPageArgs extends DocsSpaceArgs {
  parentId?: string | null;
  title: string;
  content?: DocContent;
}

export interface UpdateDocsPageArgs {
  id: string;
  title: string;
  content: DocContent;
  version: number;
}

export interface RenameDocsPageArgs {
  id: string;
  title: string;
}

export interface MoveDocsPageArgs {
  id: string;
  parentId: string | null;
  position?: number;
}

export interface ToggleDocsTaskArgs {
  pageId: string;
  taskId: string;
  checked: boolean;
}

export interface DeleteDocsPageResult {
  deletedIds: string[];
}

/**
 * Ответ queryFn в форме RTK Query: либо данные, либо ошибка.
 * Свой тип, потому что QueryReturnValue из @reduxjs/toolkit наружу не экспортируется.
 */
type QueryResult<Result> =
  | { data: Result; error?: undefined }
  | { data?: undefined; error: unknown };

// Эндпоинты используют собственный baseQuery (мок или /docs) через queryFn,
// поэтому не зависят от baseQuery хост-API.
const request =
  <Arg, Result>(buildArgs: (arg: Arg) => RtkQueryArgs) =>
  async (arg: Arg, api: BaseQueryApi, extraOptions: object) =>
    // форму ответа задаёт сам эндпоинт: baseQuery отдаёт данные как unknown
    (await docsBaseQuery(buildArgs(arg), api, extraOptions)) as QueryResult<Result>;

export const docsApi = hostApi
  .enhanceEndpoints({ addTagTypes: ['DocsTree', 'DocsPage'] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getDocsTree: builder.query<DocsTreeItem[], DocsSpaceArgs>({
        queryFn: request(({ spaceType, spaceId }: DocsSpaceArgs) => ({
          url: `/Spaces/${spaceType}/${spaceId}/Tree`,
        })),
        providesTags: ['DocsTree'],
      }),
      getDocsPage: builder.query<DocsPage, GetDocsPageArgs>({
        queryFn: request(({ id }: GetDocsPageArgs) => ({ url: `/Pages/${id}` })),
        providesTags: (_result, _error, { id }) => [{ type: 'DocsPage', id }],
      }),
      createDocsPage: builder.mutation<DocsPage, CreateDocsPageArgs>({
        queryFn: request((body: CreateDocsPageArgs) => ({
          url: '/Pages',
          method: 'POST',
          body,
        })),
        // Сразу добавляем страницу в кэш дерева, чтобы переход на неё не ждал перезапроса.
        async onQueryStarted({ spaceType, spaceId }, { dispatch, queryFulfilled }) {
          try {
            const { data: page } = await queryFulfilled;
            dispatch(
              docsApi.util.updateQueryData('getDocsTree', { spaceType, spaceId }, (draft) => {
                if (!draft.some((item) => item.id === page.id)) {
                  const { id, parentId, position, title } = page;
                  draft.push({ id, parentId, position, title });
                }
              })
            );
          } catch {
            // ошибку обрабатывает вызывающий компонент
          }
        },
        invalidatesTags: ['DocsTree'],
      }),
      updateDocsPage: builder.mutation<DocsPage, UpdateDocsPageArgs>({
        queryFn: request(({ id, ...body }: UpdateDocsPageArgs) => ({
          url: `/Pages/${id}`,
          method: 'PUT',
          body,
        })),
        // При ошибке (в т.ч. 409) кэш не сбрасываем: иначе редактор пересоздастся до выбора в ConflictDialog.
        invalidatesTags: (_result, _error, { id }) =>
          _result ? ['DocsTree', { type: 'DocsPage', id }] : [],
      }),
      renameDocsPage: builder.mutation<DocsPage, RenameDocsPageArgs>({
        queryFn: request(({ id, title }: RenameDocsPageArgs) => ({
          url: `/Pages/${id}/Title`,
          method: 'PATCH',
          body: { title },
        })),
        invalidatesTags: (_result, _error, { id }) => ['DocsTree', { type: 'DocsPage', id }],
      }),
      moveDocsPage: builder.mutation<DocsPage, MoveDocsPageArgs>({
        queryFn: request(({ id, ...body }: MoveDocsPageArgs) => ({
          url: `/Pages/${id}/Move`,
          method: 'PATCH',
          body,
        })),
        invalidatesTags: (_result, _error, { id }) => ['DocsTree', { type: 'DocsPage', id }],
      }),
      // Отметка ToDo в просмотре: без version и без отправки контента.
      toggleDocsTask: builder.mutation<DocsPage, ToggleDocsTaskArgs>({
        queryFn: request(({ pageId, taskId, checked }: ToggleDocsTaskArgs) => ({
          url: `/Pages/${pageId}/Tasks/${taskId}`,
          method: 'PATCH',
          body: { checked },
        })),
        // Оптимистично меняем пункт в кэше страницы; при ошибке откатываем.
        // Ответ (страница целиком) не подставляем: он затёр бы ещё не подтверждённые отметки
        // соседних пунктов — берём только метаданные версии.
        async onQueryStarted({ pageId, taskId, checked }, { dispatch, queryFulfilled }) {
          const patch = dispatch(
            docsApi.util.updateQueryData('getDocsPage', { id: pageId }, (draft) => {
              setTaskChecked(draft.content, taskId, checked);
            })
          );
          try {
            const { data: page } = await queryFulfilled;
            dispatch(
              docsApi.util.updateQueryData('getDocsPage', { id: pageId }, (draft) => {
                if (page.version > draft.version) {
                  draft.version = page.version;
                  draft.updatedBy = page.updatedBy;
                  draft.updatedAt = page.updatedAt;
                }
              })
            );
          } catch {
            patch.undo();
          }
        },
      }),
      deleteDocsPage: builder.mutation<DeleteDocsPageResult, GetDocsPageArgs>({
        queryFn: request(({ id }: GetDocsPageArgs) => ({ url: `/Pages/${id}`, method: 'DELETE' })),
        invalidatesTags: ['DocsTree'],
      }),
    }),
    overrideExisting: false,
  });

export const {
  useGetDocsTreeQuery,
  useGetDocsPageQuery,
  useCreateDocsPageMutation,
  useUpdateDocsPageMutation,
  useRenameDocsPageMutation,
  useMoveDocsPageMutation,
  useToggleDocsTaskMutation,
  useDeleteDocsPageMutation,
} = docsApi;
