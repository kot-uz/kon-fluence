import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import httpClient from 'app/helpers/httpClient';
import type { RootState } from 'app/store';
import type { AuthUser } from 'app/auth/authApi';

interface AuthState {
  /** Аккаунт из /auth/me; в локальном режиме всегда null. */
  account: AuthUser | null;
  status: 'idle' | 'loading' | 'failed';
}

export const loadAccount = createAsyncThunk('auth/loadAccount', async () => {
  const { data } = await httpClient.get<{ user: AuthUser }>('/auth/me');
  return data.user;
});

const authSlice = createSlice({
  name: 'auth',
  initialState: { account: null, status: 'idle' } as AuthState,
  reducers: {
    setAccount: (state, action: PayloadAction<AuthUser>) => {
      state.account = action.payload;
      state.status = 'idle';
    },
    clearAccount: (state) => {
      state.account = null;
      state.status = 'idle';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadAccount.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(loadAccount.fulfilled, (state, action) => {
        state.account = action.payload;
        state.status = 'idle';
      })
      .addCase(loadAccount.rejected, (state) => {
        state.status = 'failed';
      });
  },
});

export const { setAccount, clearAccount } = authSlice.actions;

export const selectAccount = ({ auth }: RootState) => auth.account;
export const selectAuthStatus = ({ auth }: RootState) => auth.status;

export default authSlice.reducer;
