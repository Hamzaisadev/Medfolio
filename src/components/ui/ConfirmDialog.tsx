import { useState, useEffect } from 'react';
import { Dialog } from './Dialog';
import { Button } from './Button';
import { Input } from './Input';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  /** When set, the action stays disabled until the user types this exactly. */
  requiredPhrase?: string;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  requiredPhrase,
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [typedPhrase, setTypedPhrase] = useState('');

  useEffect(() => {
    if (open) setTypedPhrase('');
  }, [open]);

  const isPhraseMatch = !requiredPhrase || typedPhrase.trim() === requiredPhrase.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="space-y-5">
        {requiredPhrase && (
          <div className="space-y-2.5 rounded-[var(--radius-md)] border border-warn-border bg-warn-bg p-4">
            <p className="text-xs font-semibold text-warn-text">
              Type{' '}
              <span className="font-mono font-bold select-all bg-surface-raised text-content px-1.5 py-0.5 rounded border border-warn-border">
                {requiredPhrase}
              </span>{' '}
              to confirm:
            </p>
            <Input
              value={typedPhrase}
              onChange={(e) => setTypedPhrase(e.target.value)}
              placeholder={`Type "${requiredPhrase}"`}
            />
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-4 border-t border-line">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
            disabled={!isPhraseMatch || loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
