import { useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { Delete } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { showMessage } from 'app/store/layout/messageSlice';
import {
  useAddSpaceMemberMutation,
  useGetSpaceMembersQuery,
  useRemoveSpaceMemberMutation,
} from 'app/docs';
import type { Space, SpaceRole } from 'app/docs';

export interface SpaceMembersDialogProps {
  space: Space;
  onClose: () => void;
}

type InviteRole = Exclude<SpaceRole, 'owner'>;

// Участники облачного пространства: список для всех, добавление и удаление — для владельца.
const SpaceMembersDialog = ({ space, onClose }: SpaceMembersDialogProps) => {
  const { t } = useTranslation('translations');
  const dispatch = useDispatch();
  const { data: members = [] } = useGetSpaceMembersQuery(space.id);
  const [addMember] = useAddSpaceMemberMutation();
  const [removeMember] = useRemoveSpaceMemberMutation();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InviteRole>('editor');
  const isOwner = space.role === 'owner';

  const fail = (status?: number) => {
    const key = status === 404 ? 'AppMemberNotFound' : status === 409 ? 'AppMemberExists' : 'AppMemberError';
    dispatch(showMessage({ message: t(key), variant: 'error' }));
  };

  const submit = async () => {
    if (!email.trim()) return;
    try {
      await addMember({ spaceId: space.id, email: email.trim(), role }).unwrap();
      setEmail('');
    } catch (error) {
      fail((error as { status?: number })?.status);
    }
  };

  const remove = async (userId: string) => {
    try {
      await removeMember({ spaceId: space.id, userId }).unwrap();
    } catch (error) {
      fail((error as { status?: number })?.status);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('AppSpaceMembers')}</DialogTitle>
      <DialogContent>
        <List dense>
          {members.map((member) => (
            <ListItem
              key={member.userId}
              secondaryAction={
                isOwner && member.role !== 'owner' ? (
                  <IconButton aria-label={t('Delete')} onClick={() => remove(member.userId)}>
                    <Delete />
                  </IconButton>
                ) : null
              }
            >
              <ListItemText
                primary={member.fullName}
                secondary={`${member.email} · ${t(`AppRole_${member.role}`)}`}
              />
            </ListItem>
          ))}
        </List>
        {isOwner ? (
          <div className="flex flex-wrap items-start gap-8 mt-8">
            <TextField
              className="flex-1 min-w-200"
              size="small"
              type="email"
              label={t('AppMemberEmail')}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && submit()}
            />
            <TextField
              select
              size="small"
              label={t('AppMemberRole')}
              value={role}
              onChange={(event) => setRole(event.target.value as InviteRole)}
            >
              <MenuItem value="editor">{t('AppRole_editor')}</MenuItem>
              <MenuItem value="viewer">{t('AppRole_viewer')}</MenuItem>
            </TextField>
            <Button variant="contained" onClick={submit}>
              {t('Add')}
            </Button>
          </div>
        ) : (
          <Typography color="text.secondary">{t('AppMembersOwnerOnly')}</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('Close')}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default SpaceMembersDialog;
