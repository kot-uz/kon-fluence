import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Alert, Button, Paper, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { docsHostApi } from 'app/services/docs/docsHostApi';
import { setAccount } from 'app/store/authSlice';
import { isCloudAvailable, setStorageMode } from 'app/store/storageModeSlice';
import { login, register } from './authApi';

interface Props {
  mode: 'login' | 'register';
}

/** Сообщение сервера из ответа axios: бекенд отдаёт ошибки как { message, code }. */
const errorText = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

// Страницы входа и регистрации: отличаются только полем имени и ссылками.
const AuthPage = ({ mode }: Props) => {
  const { t } = useTranslation('translations');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isRegister = mode === 'register';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  // без адреса бекенда аккаунтов нет
  if (!isCloudAvailable) return <Navigate to="/" replace />;

  const enterMode = (storageMode: 'local' | 'cloud') => {
    dispatch(setStorageMode(storageMode));
    // кэш хранит данные прежнего режима
    dispatch(docsHostApi.util.resetApiState());
    navigate('/', { replace: true });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      const user = isRegister
        ? await register({ email, password, fullName })
        : await login(email, password);
      dispatch(setAccount(user));
      enterMode('cloud');
    } catch (err) {
      setError(errorText(err, t('Error')));
      setPending(false);
    }
  };

  return (
    <div className="flex flex-auto items-center justify-center p-16">
      <Paper
        component="form"
        onSubmit={submit}
        variant="outlined"
        className="flex flex-col gap-16 p-24 w-full"
        sx={{ maxWidth: 400 }}
      >
        <Typography variant="h6">{t(isRegister ? 'AuthRegisterTitle' : 'AuthLoginTitle')}</Typography>
        {error && <Alert severity="error">{error}</Alert>}
        {isRegister && (
          <TextField
            required
            autoFocus
            label={t('FullName')}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            inputProps={{ maxLength: 255 }}
          />
        )}
        <TextField
          required
          autoFocus={!isRegister}
          type="email"
          label="Email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <TextField
          required
          type="password"
          label={t('AuthPassword')}
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          helperText={isRegister ? t('AuthPasswordHint') : undefined}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          inputProps={{ minLength: isRegister ? 8 : undefined, maxLength: 128 }}
        />
        <Button type="submit" variant="contained" disabled={pending}>
          {t(isRegister ? 'AuthRegister' : 'AuthLogin')}
        </Button>
        <Typography variant="body2" className="text-center">
          {t(isRegister ? 'AuthHaveAccount' : 'AuthNoAccount')}{' '}
          <Link to={isRegister ? '/login' : '/register'}>
            {t(isRegister ? 'AuthLogin' : 'AuthRegister')}
          </Link>
        </Typography>
        <Button onClick={() => enterMode('local')}>{t('AuthContinueWithout')}</Button>
      </Paper>
    </div>
  );
};

export default AuthPage;
