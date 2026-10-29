import { useCallback, useEffect } from 'react';
import { DocsLoading, handleError, useDocsTranslation } from '../../adapters/platform';
import { useGetDocsPageQuery, useToggleDocsTaskMutation } from '../../api/docsApi';
import { DOCS_MODE } from '../../constants';
import { useDocsContext } from '../../context/DocsContext';
import type { DocsTreeItem } from '../../types';
import PageHeader from '../layout/PageHeader';
import DocViewer from '../editor/DocEditor';

const isTypingOrModal = (target: EventTarget | null) =>
  target instanceof Element &&
  !!target.closest(
    'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"], [role="listbox"]'
  );

export interface PageViewProps {
  pageId: string;
  items: DocsTreeItem[];
}

const PageView = ({ pageId, items }: PageViewProps) => {
  const { t } = useDocsTranslation();
  const { canEdit, navigate } = useDocsContext();
  const { data: page, isLoading, isError } = useGetDocsPageQuery({ id: pageId });
  const [toggleTask] = useToggleDocsTaskMutation();

  // Чекбокс остаётся отмеченным сразу (оптимистично); при ошибке кэш откатывается
  // и просмотр перерисовывает пункт с прежним значением.
  const handleTaskToggle = useCallback(
    (taskId: string, checked: boolean) => {
      toggleTask({ pageId, taskId, checked }).unwrap().catch(handleError);
      return true;
    },
    [toggleTask, pageId]
  );

  // E — «Редактировать» (event.code не зависит от раскладки). Не срабатывает при вводе текста
  // и в открытых диалогах/меню.
  useEffect(() => {
    if (!canEdit) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'KeyE' || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.shiftKey || event.repeat || event.defaultPrevented) return;
      if (isTypingOrModal(event.target)) return;
      event.preventDefault();
      navigate(pageId, DOCS_MODE.EDIT);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canEdit, navigate, pageId]);

  if (isLoading) return <DocsLoading />;
  if (isError || !page) {
    return <p className="p-48 text-center text-lg">{t('DocsPageNotFound')}</p>;
  }

  const isEmpty = !page.content?.content?.length;

  return (
    <article className="docs-page mx-auto px-24 md:px-48 pt-48 pb-96">
      <PageHeader page={page} items={items} />
      {isEmpty ? (
        <p className="text-gray-500 italic">{t('DocsEmptyPage')}</p>
      ) : (
        <DocViewer content={page.content} onTaskToggle={canEdit ? handleTaskToggle : undefined} />
      )}
    </article>
  );
};

export default PageView;
