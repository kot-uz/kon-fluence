// Единственная точка, где модуль документации знает о сущностях, к которым привязаны пространства.
// Список пространств отдаёт API (локальные обработчики или бекенд).
import { useMemo } from 'react';
import { useAppSelector } from 'app/store';
import { selectUser } from 'app/store/userSlice';
import { selectAccount } from 'app/store/authSlice';
import { selectStorageMode } from 'app/store/storageModeSlice';
import { useGetSpacesQuery } from '../api/spacesApi';
import { SPACE_TYPES } from '../constants';
import type { DocsUser, SpaceInfo } from '../types';

/**
 * Информация о пространстве для отдельного роута: { isLoading, notFound, title, backUrl, canEdit }.
 * Хуки вызываются безусловно (правила хуков), неподходящий spaceType отсеивается после.
 */
export const useSpaceInfo = (spaceType: string | undefined, spaceId: string | undefined): SpaceInfo => {
  const { data: spaces, isLoading } = useGetSpacesQuery();
  const space = spaces?.find((item) => item.id === spaceId);

  return useMemo(() => {
    if (isLoading) return { isLoading: true, notFound: false };
    if (spaceType !== SPACE_TYPES.SPACE || !space) {
      return { isLoading: false, notFound: true };
    }
    return {
      isLoading: false,
      notFound: false,
      title: space.title,
      backUrl: '/',
      // локальные пространства без роли — однопользовательские; в облаке читатель не редактирует
      canEdit: space.role !== 'viewer',
    };
  }, [spaceType, space, isLoading]);
};

export const useCurrentUser = (): DocsUser => {
  const user = useAppSelector(selectUser);
  const account = useAppSelector(selectAccount);
  const isCloud = useAppSelector(selectStorageMode) === 'cloud';
  return useMemo(
    () =>
      isCloud && account
        ? { id: account.id, fullName: account.fullName }
        : { id: user?.staffId, fullName: user?.fio || user?.fullName },
    [isCloud, account, user?.staffId, user?.fio, user?.fullName]
  );
};
