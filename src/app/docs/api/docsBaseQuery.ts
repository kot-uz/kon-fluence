import { selectStorageMode } from 'app/store/storageModeSlice';
import type { RootState } from 'app/store';
import type { DocsBaseQuery } from 'app/helpers/rtkquery';
import { rtkBaseQuery } from '../adapters/transport';
import { localBaseQuery } from '../local/localBaseQuery';

const cloudBaseQuery = rtkBaseQuery('/docs');

// Транспорт выбирается на каждый запрос по текущему режиму хранения.
export const docsBaseQuery: DocsBaseQuery = (args, api, extraOptions) =>
  selectStorageMode(api.getState() as RootState) === 'local'
    ? localBaseQuery(args, api, extraOptions)
    : cloudBaseQuery(args, api, extraOptions);
