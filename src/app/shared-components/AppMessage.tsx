import { useDispatch } from 'react-redux';
import { Alert, Snackbar } from '@mui/material';
import { useAppSelector } from 'app/store';
import {
  hideMessage,
  selectMessageOptions,
  selectMessageState,
} from 'app/store/layout/messageSlice';

// Показывает сообщения из messageSlice.
const AppMessage = () => {
  const dispatch = useDispatch();
  const open = useAppSelector(selectMessageState);
  const options = useAppSelector(selectMessageOptions);

  return (
    <Snackbar
      open={!!open}
      anchorOrigin={options.anchorOrigin}
      autoHideDuration={options.autoHideDuration}
      onClose={() => dispatch(hideMessage())}
    >
      <Alert
        severity={options.variant || 'info'}
        variant="filled"
        onClose={() => dispatch(hideMessage())}
      >
        {options.message}
      </Alert>
    </Snackbar>
  );
};

export default AppMessage;
