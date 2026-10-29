// Единственная точка, где модуль документации зависит от UI-платформы приложения
// (shared-components, store, i18n): app/shared-components/*, app/store/*.
import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Loading from 'app/shared-components/Loading';
import handleError from 'src/app/helpers/errorHandler';
import { showMessage } from 'app/store/layout/messageSlice';
import type { MessageVariant } from 'app/store/layout/messageSlice';

export { Loading as DocsLoading, handleError };

export const useDocsTranslation = () => useTranslation('translations');

/** Перевод в модуле документации: t(key, params). */
export type DocsTranslate = ReturnType<typeof useDocsTranslation>['t'];

export const useNotify = () => {
  const dispatch = useDispatch();
  return useCallback(
    (message: string, variant: MessageVariant = 'success') =>
      dispatch(showMessage({ message, variant })),
    [dispatch]
  );
};

export { default as DocsPageLayout } from 'app/shared-components/PageSimple';
export { authRoles } from 'src/app/auth';
