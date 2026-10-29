import { createSlice } from '@reduxjs/toolkit';
import type { RootState } from 'app/store';

// Счётчик запросов на ручной перенос: каждый клик по пункту меню меняет значение.
const importSlice = createSlice({
  name: 'import',
  initialState: { requests: 0 },
  reducers: {
    requestImport: (state) => {
      state.requests += 1;
    },
  },
});

export const { requestImport } = importSlice.actions;

export const selectImportRequests = ({ import: state }: RootState) => state.requests;

export default importSlice.reducer;
