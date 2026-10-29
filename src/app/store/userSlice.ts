import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from 'app/store';

// Автор правок. Бекенда авторизации нет, поэтому
// пользователь задаётся локально и хранится в localStorage.
// Моки и адаптеры читают поля staffId, fio, roles как есть.
const STORAGE_KEY = 'docs-current-user';

export interface User {
  staffId: string;
  fio: string;
  /** Имя может приходить и под этим ключом. */
  fullName?: string;
  roles: string[];
}

const defaultUser: User = { staffId: 'local', fio: 'Локальный пользователь', roles: ['user'] };

const readUser = (): User => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaultUser, ...(JSON.parse(raw) as Partial<User>) } : defaultUser;
  } catch {
    return defaultUser;
  }
};

const userSlice = createSlice({
  name: 'user',
  initialState: readUser(),
  reducers: {
    setUserName: (state, action: PayloadAction<string | null | undefined>) => {
      state.fio = action.payload?.trim() || defaultUser.fio;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ staffId: state.staffId, fio: state.fio }));
      } catch {
        // приватный режим браузера — сохранять некуда, значение останется только в памяти
      }
    },
  },
});

export const { setUserName } = userSlice.actions;

export const selectUser = ({ user }: RootState) => user;

export default userSlice.reducer;
