import { createContext, useContext } from 'react';
import type { DocsContextValue } from '../types';

export const DocsContext = createContext<DocsContextValue | null>(null);

export const useDocsContext = () => {
  const context = useContext(DocsContext);
  if (!context) throw new Error('useDocsContext must be used within DocsContext.Provider');
  return context;
};
