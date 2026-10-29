import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import moment from 'moment';
import { Alert, Button, Dialog, DialogActions, DialogTitle } from '@mui/material';
import type { Editor } from '@tiptap/react';
import { DocsLoading, handleError, useDocsTranslation, useNotify } from '../../adapters/platform';
import { useGetDocsPageQuery, useUpdateDocsPageMutation } from '../../api/docsApi';
import { DOCS_MODE, PAGE_TITLE_MAX_LENGTH } from '../../constants';
import { useDocsContext } from '../../context/DocsContext';
import { useDraft } from '../../hooks/useDraft';
import { useUploadFiles } from '../../hooks/useUploadFiles';
import type { UploadFiles } from '../../hooks/useUploadFiles';
import { ensureTaskIds } from '@kon-fluence/shared';
import type { DocContent, DocsPage } from '../../types';
import { DocEditorContent, useDocEditor } from '../editor/DocEditor';
import EditorToolbar from '../editor/toolbar/EditorToolbar';
import TableBubbleMenu from '../editor/toolbar/TableBubbleMenu';
import ConflictDialog from './ConflictDialog';

const isSameContent = (a: DocContent | undefined, b: DocContent | undefined) =>
  JSON.stringify(a) === JSON.stringify(b);

interface PageEditorProps {
  page: DocsPage;
  onReload: () => void;
}

const PageEditor = ({ page, onReload }: PageEditorProps) => {
  const { t } = useDocsTranslation();
  const notify = useNotify();
  const { navigate } = useDocsContext();
  const [updatePage, { isLoading: isSaving }] = useUpdateDocsPageMutation();
  const { initialDraft, savedAt, saveDraft, flushDraft, clearDraft } = useDraft(page.id);

  const [title, setTitle] = useState(page.title);
  const [baseVersion, setBaseVersion] = useState(page.version);
  const [isDirty, setIsDirty] = useState(false);
  const [conflictPage, setConflictPage] = useState<DocsPage | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showDraftBanner, setShowDraftBanner] = useState(
    () =>
      !!initialDraft &&
      (initialDraft.title !== page.title || !isSameContent(initialDraft.content, page.content))
  );

  // актуальные значения для колбэков редактора и горячих клавиш
  const stateRef = useRef({ title, baseVersion });
  stateRef.current = { title, baseVersion };

  const editorRef = useRef<Editor | null>(null);
  const storeDraft = useCallback(
    (nextTitle = stateRef.current.title) => {
      const editor = editorRef.current;
      if (!editor) return;
      setIsDirty(true);
      saveDraft({
        title: nextTitle,
        content: editor.getJSON(),
        baseVersion: stateRef.current.baseVersion,
      });
    },
    [saveDraft]
  );

  // редактор создаётся раньше хука загрузки — колбэк для drop/paste берём через ref
  const uploadFilesRef = useRef<UploadFiles | null>(null);
  const editor = useDocEditor({
    content: page.content,
    editable: true,
    placeholder: t('DocsEditorPlaceholder'),
    onUpdate: () => storeDraft(),
    onFiles: (files, pos) => uploadFilesRef.current?.(files, pos),
  });
  editorRef.current = editor;

  const { uploadFiles, pendingCount } = useUploadFiles({ editor, pageId: page.id });
  uploadFilesRef.current = uploadFiles;

  const handleTitleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTitle(event.target.value);
    storeDraft(event.target.value);
  };

  const restoreDraft = () => {
    if (!editor || !initialDraft) return;
    editor.commands.setContent(initialDraft.content);
    setTitle(initialDraft.title);
    // версия, на которой начат черновик: если страницу с тех пор меняли, публикация даст конфликт
    setBaseVersion(initialDraft.baseVersion ?? page.version);
    setIsDirty(true);
    setShowDraftBanner(false);
  };

  const discardDraft = () => {
    clearDraft();
    setShowDraftBanner(false);
  };

  const publish = async (version = stateRef.current.baseVersion) => {
    if (!editor || isSaving) return;
    // иначе на странице не будет блоков файлов, которые ещё загружаются
    if (pendingCount > 0) {
      notify(t('DocsWaitForUploads'), 'warning');
      return;
    }
    // id пунктов ToDo нужны для отметки в просмотре
    const content = ensureTaskIds(editor.getJSON());
    const nextTitle = stateRef.current.title.trim() || page.title;
    try {
      await updatePage({ id: page.id, title: nextTitle, content, version }).unwrap();
      clearDraft();
      setIsDirty(false);
      setConflictPage(null);
      notify(t('DocsPagePublished'));
      navigate(page.id, DOCS_MODE.VIEW);
    } catch (error) {
      const failure = error as { status?: number; data?: { data?: DocsPage } };
      if (failure?.status === 409) {
        saveDraft({ title: nextTitle, content, baseVersion: stateRef.current.baseVersion });
        flushDraft();
        setConflictPage(failure.data?.data || null);
        return;
      }
      handleError(error);
    }
  };
  const publishRef = useRef(publish);
  publishRef.current = publish;

  const handleCancel = () => {
    if (isDirty) {
      setConfirmCancel(true);
      return;
    }
    navigate(page.id, DOCS_MODE.VIEW);
  };

  const discardChanges = () => {
    clearDraft();
    setIsDirty(false);
    navigate(page.id, DOCS_MODE.VIEW);
  };

  const handleConflictReload = () => {
    flushDraft();
    setConflictPage(null);
    onReload();
  };

  // Ctrl/Cmd+S — опубликовать (event.code не зависит от раскладки)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.code === 'KeyS') {
        event.preventDefault();
        publishRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // предупреждение браузера при закрытии вкладки с неопубликованными правками
  useEffect(() => {
    if (!isDirty) return undefined;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      flushDraft();
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, flushDraft]);

  return (
    <article className="docs-page mx-auto px-24 md:px-48 pt-48 pb-96">
      {showDraftBanner && initialDraft && (
        <Alert
          severity="info"
          className="mb-16"
          action={
            <div className="flex gap-8">
              <Button size="small" color="inherit" onClick={discardDraft}>
                {t('DocsDraftDiscard')}
              </Button>
              <Button size="small" variant="outlined" color="inherit" onClick={restoreDraft}>
                {t('DocsDraftRestore')}
              </Button>
            </div>
          }
        >
          {t('DocsDraftFound', {
            date: moment(initialDraft.savedAt).format('DD.MM.YYYY HH:mm'),
          })}
        </Alert>
      )}

      <input
        className="w-full text-4xl font-bold leading-tight bg-transparent outline-none dark:text-white placeholder-gray-400"
        value={title}
        onChange={handleTitleChange}
        placeholder={t('DocsTitlePlaceholder')}
        maxLength={PAGE_TITLE_MAX_LENGTH}
        aria-label={t('DocsPageTitle')}
      />

      <div className="sticky top-0 z-[5] mt-16 mb-16 bg-white dark:bg-dark border border-gray-200 dark:border-gray-700 rounded-lg">
        <EditorToolbar editor={editor} onUploadFiles={uploadFiles} />
        <div className="flex flex-wrap items-center justify-end gap-8 px-12 py-6">
          <span className="mr-auto text-xs text-gray-500 dark:text-gray-400">
            {pendingCount > 0
              ? t('DocsUploadingFiles', { count: pendingCount })
              : savedAt && t('DocsDraftSaved', { time: moment(savedAt).format('HH:mm') })}
          </span>
          <Button size="small" onClick={handleCancel} disabled={isSaving}>
            {t('Cancel')}
          </Button>
          <Button
            size="small"
            variant="contained"
            color="secondary"
            onClick={() => publish()}
            disabled={isSaving || !editor || pendingCount > 0}
          >
            {t('Publish')}
          </Button>
        </div>
      </div>

      <DocEditorContent editor={editor} className="docs-editor" />
      {editor && <TableBubbleMenu editor={editor} />}

      {conflictPage !== null && (
        <ConflictDialog
          serverPage={conflictPage}
          isLoading={isSaving}
          onClose={() => setConflictPage(null)}
          onReload={handleConflictReload}
          onOverwrite={() => publish(conflictPage?.version)}
        />
      )}

      {confirmCancel && (
        <Dialog open onClose={() => setConfirmCancel(false)} maxWidth="xs" fullWidth>
          <DialogTitle>{t('DocsUnsavedChanges')}</DialogTitle>
          <DialogActions>
            <Button onClick={() => setConfirmCancel(false)}>{t('DocsContinueEditing')}</Button>
            <Button variant="contained" color="error" onClick={discardChanges}>
              {t('DocsDiscardChanges')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </article>
  );
};

export interface PageEditProps {
  pageId: string;
}

const PageEdit = ({ pageId }: PageEditProps) => {
  const { t } = useDocsTranslation();
  // при входе в редактирование берём свежую версию, чтобы не публиковать поверх устаревшей
  const {
    data: page,
    isFetching,
    isError,
    refetch,
  } = useGetDocsPageQuery({ id: pageId }, { refetchOnMountOrArgChange: true });

  if (isFetching) return <DocsLoading />;
  if (isError || !page) {
    return <p className="p-48 text-center text-lg">{t('DocsPageNotFound')}</p>;
  }

  return <PageEditor key={page.version} page={page} onReload={refetch} />;
};

export default PageEdit;
