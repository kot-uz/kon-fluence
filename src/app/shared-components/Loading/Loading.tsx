import { useEffect, useState } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import clsx from 'clsx';

export interface LoadingProps {
  /** Задержка до появления индикатора, мс. false — показывать сразу. */
  delay?: number | false;
}

/**
 * Индикатор загрузки. С delay появляется не сразу, чтобы не мигать на быстрых загрузках.
 */
function Loading({ delay = false }: LoadingProps) {
  const [showLoading, setShowLoading] = useState(!delay);

  useEffect(() => {
    if (!delay) return undefined;
    const timer = setTimeout(() => setShowLoading(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={clsx(
        'flex flex-1 flex-col items-center justify-center p-24',
        !showLoading && 'hidden'
      )}
    >
      <CircularProgress color="secondary" size={32} />
    </div>
  );
}

export default Loading;
