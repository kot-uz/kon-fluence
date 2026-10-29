import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from 'app/store';

const STORAGE_KEY = 'docs-storage-mode';

/** local — IndexedDB браузера, cloud — бекенд. */
export type StorageMode = 'local' | 'cloud';

export const DEFAULT_STORAGE_MODE: StorageMode = 'local';

/** Облачный режим доступен, только если задан адрес бекенда. */
export const isCloudAvailable = Boolean(process.env.REACT_APP_API_URL);

/** Режимы, доступные для выбора в интерфейсе. */
export const STORAGE_MODES: StorageMode[] = isCloudAvailable ? ['local', 'cloud'] : ['local'];

export const readStorageMode = (): StorageMode => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'cloud' && isCloudAvailable ? 'cloud' : DEFAULT_STORAGE_MODE;
  } catch {
    return DEFAULT_STORAGE_MODE;
  }
};

const storageModeSlice = createSlice({
  name: 'storageMode',
  initialState: { mode: readStorageMode() as StorageMode },
  reducers: {
    setStorageMode: (state, action: PayloadAction<StorageMode>) => {
      const mode =
        action.payload === 'cloud' && !isCloudAvailable ? DEFAULT_STORAGE_MODE : action.payload;
      state.mode = mode;
      try {
        localStorage.setItem(STORAGE_KEY, mode);
      } catch {
        // приватный режим браузера — сохранять некуда, значение останется только в памяти
      }
    },
  },
});

export const { setStorageMode } = storageModeSlice.actions;

export const selectStorageMode = ({ storageMode }: RootState) => storageMode.mode;

export default storageModeSlice.reducer;
