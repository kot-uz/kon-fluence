import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  AppBar,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ArrowDropDown,
  Cloud,
  Computer,
  DarkMode,
  LightMode,
  DeleteSweep,
  Logout,
  MenuBook,
  Person,
  Upload,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from 'app/store';
import { LANGUAGES, selectLanguage, setLanguage } from 'app/store/i18nSlice';
import type { Language } from 'app/store/i18nSlice';
import { selectUser, setUserName } from 'app/store/userSlice';
import { showMessage } from 'app/store/layout/messageSlice';
import { useThemeMode } from 'app/theme/AppThemeProvider';
import ConfirmDialog from 'app/shared-components/ConfirmDialog';
import {
  STORAGE_MODES,
  isCloudAvailable,
  selectStorageMode,
  setStorageMode,
} from 'app/store/storageModeSlice';
import type { StorageMode } from 'app/store/storageModeSlice';
import { clearAccount, selectAccount } from 'app/store/authSlice';
import { requestImport } from 'app/store/importSlice';
import { logout } from 'app/auth/authApi';
import { docsHostApi } from 'app/services/docs/docsHostApi';
import { resetDocsLocalData } from 'app/docs';

// Шапка приложения.
const AppHeader = () => {
  const { t } = useTranslation('translations');
  const dispatch = useDispatch();
  const { isDark, toggle } = useThemeMode();
  const language = useAppSelector(selectLanguage);
  const user = useAppSelector(selectUser);
  const account = useAppSelector(selectAccount);
  const storageMode = useAppSelector(selectStorageMode);
  const isLocalMode = storageMode === 'local';
  const navigate = useNavigate();
  const [modeAnchor, setModeAnchor] = useState<HTMLElement | null>(null);
  const [accountAnchor, setAccountAnchor] = useState<HTMLElement | null>(null);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [name, setName] = useState(user.fio);

  const openUserDialog = () => {
    setName(user.fio);
    setUserDialogOpen(true);
  };

  const saveName = () => {
    dispatch(setUserName(name));
    dispatch(showMessage({ message: t('AppUserNameSaved') }));
    setUserDialogOpen(false);
  };

  const changeMode = (mode: StorageMode) => {
    setModeAnchor(null);
    if (mode === storageMode) return;
    dispatch(setStorageMode(mode));
    // кэш хранит данные прежнего режима
    dispatch(docsHostApi.util.resetApiState());
    navigate('/');
  };

  const signOut = async () => {
    setAccountAnchor(null);
    await logout();
    dispatch(clearAccount());
    dispatch(setStorageMode('local'));
    dispatch(docsHostApi.util.resetApiState());
    navigate('/');
  };

  const resetData = async () => {
    await resetDocsLocalData();
    // проще перезагрузить страницу, чем сбрасывать кэш RTK Query и состояние редактора
    window.location.reload();
  };

  return (
    <>
      <AppBar position="static" color="default" elevation={0} className="shrink-0">
        <Toolbar variant="dense" className="gap-12 px-16" sx={{ minHeight: 44 }}>
          <MenuBook color="primary" fontSize="small" />
          <Typography
            component={Link}
            to="/"
            variant="subtitle1"
            className="font-bold no-underline"
            color="inherit"
          >
            {t('AppTitle')}
          </Typography>

          <Tooltip title={t('AppStorageMode')}>
            <Chip
              size="small"
              variant="outlined"
              color={isLocalMode ? 'warning' : 'primary'}
              icon={isLocalMode ? <Computer /> : <Cloud />}
              label={t(isLocalMode ? 'AppStorageLocal' : 'AppStorageCloud')}
              // без адреса бекенда выбирать не из чего
              onClick={isCloudAvailable ? (event) => setModeAnchor(event.currentTarget) : undefined}
              onDelete={
                isCloudAvailable ? (event) => setModeAnchor(event.currentTarget) : undefined
              }
              deleteIcon={<ArrowDropDown />}
            />
          </Tooltip>
          <Menu anchorEl={modeAnchor} open={!!modeAnchor} onClose={() => setModeAnchor(null)}>
            {STORAGE_MODES.map((mode) => (
              <MenuItem key={mode} selected={mode === storageMode} onClick={() => changeMode(mode)}>
                {t(mode === 'local' ? 'AppStorageLocal' : 'AppStorageCloud')}
              </MenuItem>
            ))}
          </Menu>

          <div className="flex-1" />

          <Tooltip title={t('Language')} placement="left">
            <TextField
              select
              size="small"
              value={language}
              onChange={(event) => dispatch(setLanguage(event.target.value as Language))}
              sx={{ minWidth: 120, '& .MuiInputBase-input': { py: '4px' } }}
            >
              {LANGUAGES.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.title}
                </MenuItem>
              ))}
            </TextField>
          </Tooltip>

          <Tooltip title={t(isDark ? 'LightMode' : 'DarkMode')}>
            <IconButton size="small" onClick={toggle}>
              {isDark ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
            </IconButton>
          </Tooltip>

          {isLocalMode ? (
            <Tooltip title={`${t('AppUserName')}: ${user.fio}`}>
              <IconButton size="small" onClick={openUserDialog}>
                <Person fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : (
            <>
              <Tooltip title={account?.fullName ?? ''}>
                <IconButton size="small" onClick={(event) => setAccountAnchor(event.currentTarget)}>
                  <Person fontSize="small" />
                </IconButton>
              </Tooltip>
              <Menu
                anchorEl={accountAnchor}
                open={!!accountAnchor}
                onClose={() => setAccountAnchor(null)}
              >
                <MenuItem disabled>{account?.email}</MenuItem>
                <MenuItem
                  onClick={() => {
                    setAccountAnchor(null);
                    dispatch(requestImport());
                  }}
                >
                  <Upload fontSize="small" className="mr-8" />
                  {t('AppImportData')}
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setAccountAnchor(null);
                    setResetConfirmOpen(true);
                  }}
                >
                  <DeleteSweep fontSize="small" className="mr-8" />
                  {t('AppClearLocalData')}
                </MenuItem>
                <MenuItem onClick={signOut}>
                  <Logout fontSize="small" className="mr-8" />
                  {t('AuthLogout')}
                </MenuItem>
              </Menu>
            </>
          )}
        </Toolbar>
      </AppBar>

      <Dialog
        open={userDialogOpen}
        onClose={() => setUserDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{t('AppUserName')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label={t('FullName')}
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && saveName()}
          />
        </DialogContent>
        <DialogActions className="justify-between">
          {isLocalMode ? (
            <Button color="error" onClick={() => setResetConfirmOpen(true)}>
              {t('AppResetData')}
            </Button>
          ) : (
            <span />
          )}
          <div>
            <Button onClick={() => setUserDialogOpen(false)}>{t('Cancel')}</Button>
            <Button variant="contained" onClick={saveName}>
              {t('Save')}
            </Button>
          </div>
        </DialogActions>
      </Dialog>

      {resetConfirmOpen && (
        <ConfirmDialog
          title={t(isLocalMode ? 'AppResetData' : 'AppClearLocalData')}
          text={t(isLocalMode ? 'AppResetDataConfirm' : 'AppClearLocalDataConfirm')}
          onConfirm={resetData}
          onClose={() => setResetConfirmOpen(false)}
        />
      )}
    </>
  );
};

export default AppHeader;
