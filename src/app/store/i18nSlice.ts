import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import i18next from 'i18next';
import type { RootState } from 'app/store';

const STORAGE_KEY = 'docs-language';

export const DEFAULT_LANGUAGE = 'ru';
export const LANGUAGES = [
  { id: 'ru', title: 'Русский' },
  { id: 'uz', title: "O'zbekcha" },
] as const;

/** Код языка интерфейса. */
export type Language = (typeof LANGUAGES)[number]['id'];

export const readLanguage = (): Language => {
  const saved = localStorage.getItem(STORAGE_KEY);
  return LANGUAGES.some((item) => item.id === saved) ? (saved as Language) : DEFAULT_LANGUAGE;
};

const i18nSlice = createSlice({
  name: 'i18n',
  initialState: { language: readLanguage() as Language },
  reducers: {
    setLanguage: (state, action: PayloadAction<Language>) => {
      state.language = action.payload;
      localStorage.setItem(STORAGE_KEY, action.payload);
      i18next.changeLanguage(action.payload);
      document.documentElement.lang = action.payload;
    },
  },
});

export const { setLanguage } = i18nSlice.actions;

export const selectLanguage = ({ i18n }: RootState) => i18n.language;

export default i18nSlice.reducer;
