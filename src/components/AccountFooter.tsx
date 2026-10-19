import { useState } from 'react';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useToast } from '../state/Toast';
import { ConfirmDialog } from './ConfirmDialog';

/** Sign out and Delete account. They live in the page footer, away from the main content. */
export function AccountFooter() {
  const { user, profile, signOut, deleteAccount } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  if (!user || !profile) return null;

  const removeAccount = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      toast(t('account_deleted'));
    } catch {
      toast(t('error_generic'), 'error');
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <>
      <div className="mt-3 flex items-center justify-center gap-3">
        <button type="button" className="btn btn-ghost btn-sm" onClick={signOut}>{t('sign_out')}</button>
        <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirming(true)}>{t('delete_account')}</button>
      </div>
      {confirming && (
        <ConfirmDialog
          title={t('delete_account_title')}
          confirmLabel={t('delete_account_confirm')}
          requireText={profile.handle}
          requireLabel={t('type_handle_to_confirm', { handle: profile.handle })}
          busy={deleting}
          onConfirm={removeAccount}
          onCancel={() => setConfirming(false)}
        >
          <p>{t('delete_account_warning')}</p>
          <ul className="list-disc pl-5">
            <li>{t('delete_item_posts')}</li>
            <li>{t('delete_item_messages')}</li>
            <li>{t('delete_item_wallet')}</li>
          </ul>
          <p className="font-medium text-zinc-800">{t('cannot_undo')}</p>
        </ConfirmDialog>
      )}
    </>
  );
}
