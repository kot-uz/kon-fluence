import { hostApi } from '../adapters/transport';
import type { Space } from '../types';
import { request } from './request';

export interface SpaceTitleArgs {
  title: string;
}

export interface RenameSpaceArgs extends SpaceTitleArgs {
  id: string;
}

export const spacesApi = hostApi.enhanceEndpoints({ addTagTypes: ['Spaces'] }).injectEndpoints({
  endpoints: (builder) => ({
    getSpaces: builder.query<Space[], void>({
      queryFn: request(() => ({ url: '/Spaces' })),
      providesTags: ['Spaces'],
    }),
    createSpace: builder.mutation<Space, SpaceTitleArgs>({
      queryFn: request((body: SpaceTitleArgs) => ({ url: '/Spaces', method: 'POST', body })),
      invalidatesTags: ['Spaces'],
    }),
    renameSpace: builder.mutation<Space, RenameSpaceArgs>({
      queryFn: request(({ id, title }: RenameSpaceArgs) => ({
        url: `/Spaces/${id}`,
        method: 'PATCH',
        body: { title },
      })),
      invalidatesTags: ['Spaces'],
    }),
    deleteSpace: builder.mutation<void, string>({
      queryFn: request((id: string) => ({ url: `/Spaces/${id}`, method: 'DELETE' })),
      invalidatesTags: ['Spaces'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetSpacesQuery,
  useCreateSpaceMutation,
  useRenameSpaceMutation,
  useDeleteSpaceMutation,
} = spacesApi;
