import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from 'app/store';
import { loadAccount, selectAccount, selectAuthStatus } from 'app/store/authSlice';
import { selectStorageMode } from 'app/store/storageModeSlice';
import Loading from 'app/shared-components/Loading';
import { hasAccessToken } from './authApi';

// Облачному режиму нужен вход: без токена отправляем на /login,
// с токеном подгружаем аккаунт. Локальный режим пропускаем как есть.
const CloudGuard = () => {
  const dispatch = useAppDispatch();
  const isCloud = useAppSelector(selectStorageMode) === 'cloud';
  const account = useAppSelector(selectAccount);
  const status = useAppSelector(selectAuthStatus);
  const signedIn = hasAccessToken();
  const needsAccount = isCloud && signedIn && !account && status === 'idle';

  useEffect(() => {
    if (needsAccount) dispatch(loadAccount());
  }, [needsAccount, dispatch]);

  if (!isCloud) return <Outlet />;
  // при неудаче загрузки аккаунта interceptor уже увёл на /login; если нет — токен негоден
  if (!signedIn || status === 'failed') return <Navigate to="/login" replace />;
  if (!account) return <Loading />;
  return <Outlet />;
};

export default CloudGuard;
