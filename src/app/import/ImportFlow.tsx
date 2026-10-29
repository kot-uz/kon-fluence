import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  LinearProgress,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from 'app/store';
import { selectAccount } from 'app/store/authSlice';
import { selectImportRequests } from 'app/store/importSlice';
import { showMessage } from 'app/store/layout/messageSlice';
import { selectStorageMode, setStorageMode } from 'app/store/storageModeSlice';
import { docsHostApi } from 'app/services/docs/docsHostApi';
import { flushPendingDrafts } from 'app/docs/hooks/useDraft';
import { findLocalUserData, getUserDataStats, hasUserData } from 'app/docs/local/userData';
import type { LocalUserData } from 'app/docs/local/userData';
import { findDrafts } from './buildImport';
import { readImportState, writeImportState } from './importState';
import { runImport } from './runImport';
import type { ImportProgress } from './runImport';

type Phase = 'idle' | 'ask' | 'progress' | 'error';

const errorText = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
  (error as Error)?.message ||
  '';

// Перенос данных устройства в аккаунт: вопрос после входа, окно прогресса и повтор после ошибки.
const ImportFlow = () => {
  const { t } = useTranslation('translations');
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const account = useAppSelector(selectAccount);
  const isCloud = useAppSelector(selectStorageMode) === 'cloud';
  const requests = useAppSelector(selectImportRequests);
  const [phase, setPhase] = useState<Phase>('idle');
  const [data, setData] = useState<LocalUserData | null>(null);
  const [draftCount, setDraftCount] = useState(0);
  const [resuming, setResuming] = useState(false);
  const [progress, setProgress] = useState<ImportProgress>({ stage: 'upload', done: 0, total: 0 });
  const [error, setError] = useState('');
  const checkedFor = useRef<string | null>(null);
  const handledRequests = useRef(requests);
  const userId = account?.id;

  const load = useCallback(async () => {
    // черновик открытого редактора пишется с задержкой — сбрасываем его до чтения
    flushPendingDrafts();
    const found = await findLocalUserData();
    setData(found);
    setDraftCount(findDrafts(found).size);
    return found;
  }, []);

  // после любого входа: данные есть, а решения для аккаунта ещё нет (или перенос не дописан)
  useEffect(() => {
    if (!isCloud || !userId || checkedFor.current === userId) return;
    checkedFor.current = userId;
    const state = readImportState(userId);
    if (state && state.decision !== 'started') return;
    load().then((found) => {
      if (!hasUserData(found)) return;
      setResuming(state?.decision === 'started');
      setPhase('ask');
    });
  }, [isCloud, userId, load]);

  // ручной запуск из меню: решение не учитывается
  useEffect(() => {
    if (requests === handledRequests.current || !userId) return;
    handledRequests.current = requests;
    load().then((found) => {
      if (!hasUserData(found)) {
        dispatch(showMessage({ message: t('ImportNoData'), variant: 'info' }));
        return;
      }
      setResuming(readImportState(userId)?.decision === 'started');
      setPhase('ask');
    });
  }, [requests, userId, load, dispatch, t]);

  const skip = () => {
    if (userId) writeImportState(userId, { decision: 'skipped' });
    setPhase('idle');
  };

  const start = async () => {
    if (!userId) return;
    setError('');
    setProgress({ stage: 'upload', done: 0, total: 0 });
    setPhase('progress');
    try {
      // данные могли измениться, пока висел диалог
      const found = await load();
      await runImport(userId, found, findDrafts(found), setProgress);
      dispatch(setStorageMode('cloud'));
      dispatch(docsHostApi.util.resetApiState());
      dispatch(showMessage({ message: t('ImportDone'), variant: 'success' }));
      setPhase('idle');
      navigate('/');
    } catch (err) {
      setError(errorText(err));
      setPhase('error');
    }
  };

  if (phase === 'idle' || !data) return null;
  const stats = getUserDataStats(data);

  if (phase === 'ask') {
    return (
      <Dialog open onClose={() => setPhase('idle')} fullWidth maxWidth="xs">
        <DialogTitle>{t('ImportTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            {resuming && (
              <Alert severity="info" className="mb-12">
                {t('ImportResumeHint')}
              </Alert>
            )}
            <Typography variant="body2" className="mb-8">
              {t('ImportText')}
            </Typography>
            <ul className="m-0 pl-20">
              <li>{t('ImportSpaces', { count: stats.spaces })}</li>
              <li>{t('ImportPages', { count: stats.pages })}</li>
              <li>{t('ImportAttachments', { count: stats.attachments })}</li>
            </ul>
            {draftCount > 0 && (
              <Typography variant="body2" className="mt-8">
                {t('ImportDrafts', { count: draftCount })}
              </Typography>
            )}
            <Typography variant="body2" className="mt-8">
              {t('ImportKeepLocal')}
            </Typography>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={skip}>{t('ImportSkip')}</Button>
          <Button onClick={() => setPhase('idle')}>{t('ImportLater')}</Button>
          <Button variant="contained" onClick={start}>
            {t('ImportStart')}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  const isError = phase === 'error';
  const isCommit = progress.stage === 'commit';
  return (
    <Dialog open fullWidth maxWidth="xs" onClose={isError ? () => setPhase('idle') : undefined}>
      <DialogTitle>{t('ImportTitle')}</DialogTitle>
      <DialogContent>
        {isError ? (
          <Alert severity="error">
            {t('ImportError')}
            {error && `: ${error}`}
          </Alert>
        ) : (
          <>
            <Typography variant="body2" className="mb-12">
              {isCommit
                ? t('ImportCommitting')
                : t('ImportUploading', { done: progress.done, total: progress.total })}
            </Typography>
            <LinearProgress
              variant={isCommit || !progress.total ? 'indeterminate' : 'determinate'}
              value={progress.total ? (progress.done / progress.total) * 100 : 0}
            />
          </>
        )}
      </DialogContent>
      {isError && (
        <DialogActions>
          <Button onClick={() => setPhase('idle')}>{t('Close')}</Button>
          <Button variant="contained" onClick={start}>
            {t('ImportRetry')}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default ImportFlow;
