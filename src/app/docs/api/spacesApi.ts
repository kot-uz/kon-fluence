import { hostApi } from '../adapters/transport';
import type { Space, SpaceMember, SpaceRole } from '../types';
import { request } from './request';

export interface SpaceTitleArgs {
  title: string;
}

export interface RenameSpaceArgs extends SpaceTitleArgs {
  id: string;
}

export interface AddSpaceMemberArgs {
  spaceId: string;
  email: string;
  role: Exclude<SpaceRole, 'owner'>;
}

export interface RemoveSpaceMemberArgs {
  spaceId: string;
  userId: string;
}

export const spacesApi = hostApi.enhanceEndpoints({ addTagTypes: ['Spaces', 'SpaceMembers'] }).injectEndpoints({
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
    getSpaceMembers: builder.query<SpaceMember[], string>({
      queryFn: request((spaceId: string) => ({ url: `/Spaces/${spaceId}/Members` })),
      providesTags: ['SpaceMembers'],
    }),
    addSpaceMember: builder.mutation<SpaceMember, AddSpaceMemberArgs>({
      queryFn: request(({ spaceId, ...body }: AddSpaceMemberArgs) => ({
        url: `/Spaces/${spaceId}/Members`,
        method: 'POST',
        body,
      })),
      invalidatesTags: ['SpaceMembers'],
    }),
    removeSpaceMember: builder.mutation<void, RemoveSpaceMemberArgs>({
      queryFn: request(({ spaceId, userId }: RemoveSpaceMemberArgs) => ({
        url: `/Spaces/${spaceId}/Members/${userId}`,
        method: 'DELETE',
      })),
      invalidatesTags: ['SpaceMembers'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetSpacesQuery,
  useCreateSpaceMutation,
  useRenameSpaceMutation,
  useDeleteSpaceMutation,
  useGetSpaceMembersQuery,
  useAddSpaceMemberMutation,
  useRemoveSpaceMemberMutation,
} = spacesApi;
