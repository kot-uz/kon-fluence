import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { SnackbarOrigin } from '@mui/material';
import type { RootState } from 'app/store';

/** Вариант сообщения — severity MUI Alert. */
export type MessageVariant = 'success' | 'info' | 'warning' | 'error';

export interface MessageOptions {
  anchorOrigin: SnackbarOrigin;
  autoHideDuration: number;
  message: string;
  variant: MessageVariant | null;
}

interface MessageState {
  state: true | null;
  options: MessageOptions;
}

// Модуль документации дёргает showMessage({ message, variant }).
const initialState: MessageState = {
  state: null,
  options: {
    anchorOrigin: { vertical: 'top', horizontal: 'center' },
    autoHideDuration: 3000,
    message: '',
    variant: null,
  },
};

const messageSlice = createSlice({
  name: 'message',
  initialState,
  reducers: {
    showMessage: (state, action: PayloadAction<Partial<MessageOptions>>) => {
      state.state = true;
      state.options = { ...initialState.options, ...action.payload };
    },
    hideMessage: (state) => {
      state.state = null;
    },
  },
});

export const { hideMessage, showMessage } = messageSlice.actions;

export const selectMessageState = ({ layout }: RootState) => layout.message.state;
export const selectMessageOptions = ({ layout }: RootState) => layout.message.options;

export default messageSlice.reducer;
