import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { useDispatch, useSelector } from 'react-redux';
import type { TypedUseSelectorHook } from 'react-redux';
import { docsHostApi } from 'app/services/docs/docsHostApi';
import layout from './layout';
import user from './userSlice';
import auth from './authSlice';
import i18n from './i18nSlice';
import storageMode from './storageModeSlice';
import importState from './importSlice';

const store = configureStore({
  reducer: {
    [docsHostApi.reducerPath]: docsHostApi.reducer,
    layout,
    user,
    auth,
    i18n,
    storageMode,
    import: importState,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // в кэше страниц лежит контент редактора — проверка сериализуемости на нём только тормозит
      serializableCheck: false,
      immutableCheck: false,
    }).concat(docsHostApi.middleware),
  devTools: import.meta.env.DEV,
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

/** Типизированные хуки: избавляют от приведения state и dispatch в каждом компоненте. */
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

export default store;
