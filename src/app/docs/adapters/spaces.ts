// Единственная точка, где модуль документации знает о сущностях, к которым привязаны пространства.
// Пространства локальные — их список ведёт app/services/spaces/spacesRegistry.
import { useMemo } from 'react';
import { useAppSelector } from 'app/store';
import { selectUser } from 'app/store/userSlice';
import { useSpace } from 'app/services/spaces/spacesRegistry';
import { SPACE_TYPES } from '../constants';
import type { DocsUser, SpaceInfo } from '../types';

/**
 * Информация о пространстве для отдельного роута: { isLoading, notFound, title, backUrl, canEdit }.
 * Хуки вызываются безусловно (правила хуков), неподходящий spaceType отсеивается после.
 */
export const useSpaceInfo = (spaceType: string | undefined, spaceId: string | undefined): SpaceInfo => {
  const space = useSpace(spaceId);

  return useMemo(() => {
    if (spaceType !== SPACE_TYPES.SPACE || !space) {
      return { isLoading: false, notFound: true };
    }
    return {
      isLoading: false,
      notFound: false,
      title: space.title,
      backUrl: '/',
      // приложение локальное и однопользовательское: прав на чтение-без-записи нет
      canEdit: true,
    };
  }, [spaceType, space]);
};

export const useCurrentUser = (): DocsUser => {
  const user = useAppSelector(selectUser);
  return useMemo(
    () => ({ id: user?.staffId, fullName: user?.fio || user?.fullName }),
    [user?.staffId, user?.fio, user?.fullName]
  );
};
