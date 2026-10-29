import type { ReactNode } from 'react';
import clsx from 'clsx';

export interface PageSimpleProps {
  header?: ReactNode;
  content?: ReactNode;
  /** 'content' — прокручивается только содержимое, шапка остаётся на месте. */
  scroll?: 'normal' | 'page' | 'content';
  className?: string;
}

/**
 * Разметка страницы: шапка + содержимое.
 */
function PageSimple({ header, content, scroll = 'page', className }: PageSimpleProps) {
  return (
    <div className={clsx('flex flex-col flex-auto w-full min-h-0 min-w-0', className)}>
      {header && (
        <div className="shrink-0 border-b border-gray-200 dark:border-gray-700">{header}</div>
      )}
      <div
        className={clsx(
          'flex flex-col flex-auto min-h-0 min-w-0',
          scroll === 'content' ? 'overflow-hidden' : 'overflow-auto'
        )}
      >
        {content}
      </div>
    </div>
  );
}

export default PageSimple;
