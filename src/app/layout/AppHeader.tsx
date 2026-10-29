import { useState } from 'react';
import { Link } from 'react-router-dom';
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
  MenuItem,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import { DarkMode, LightMode, MenuBook, Person } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from 'app/store';
import { LANGUAGES, selectLanguage, setLanguage } from 'app/store/i18nSlice';
import type { Language } from 'app/store/i18nSlice';
import { selectUser, setUserName } from 'app/store/userSlice';
import { showMessage } from 'app/store/layout/messageSlice';
import { useThemeMode } from 'app/theme/AppThemeProvider';
import ConfirmDialog from 'app/shared-components/ConfirmDialog';
import { isDocsMockEnabled, resetDocsMockData } from 'app/docs';

// Шапка приложения.
const AppHeader = () => {
  const { t } = useTranslation('translations');
  const dispatch = useDispatch();
  const { isDark, toggle } = useThemeMode();
  const language = useAppSelector(selectLanguage);
  const user = useAppSelector(selectUser);
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

  const resetData = async () => {
    await resetDocsMockData();
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

          {isDocsMockEnabled && (
            <Chip size="small" variant="outlined" color="warning" label={t('AppMockMode')} />
          )}

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

          <Tooltip title={`${t('AppUserName')}: ${user.fio}`}>
            <IconButton size="small" onClick={openUserDialog}>
              <Person fontSize="small" />
            </IconButton>
          </Tooltip>
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
          {isDocsMockEnabled ? (
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
          title={t('AppResetData')}
          text={t('AppResetDataConfirm')}
          onConfirm={resetData}
          onClose={() => setResetConfirmOpen(false)}
        />
      )}
    </>
  );
};

export default AppHeader;
