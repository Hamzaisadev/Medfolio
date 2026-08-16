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
  requiredPhrase?: string; // If provided, enters "type-to-confirm" mode
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
    if (open) {
      setTypedPhrase('');
    }
  }, [open]);

  const isPhraseMatch = !requiredPhrase || typedPhrase.trim() === requiredPhrase.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="space-y-4 pt-2">
        {requiredPhrase && (
          <div className="space-y-2 rounded-[var(--radius-md)] border border-warn-border bg-warn-bg p-3.5">
            <p className="text-xs font-semibold text-warn-text">
              Type <span className="font-mono font-bold select-all bg-white px-1.5 py-0.5 rounded border border-warn-border">{requiredPhrase}</span> to confirm:
            </p>
            <Input
              value={typedPhrase}
              onChange={(e) => setTypedPhrase(e.target.value)}
              placeholder={`Type "${requiredPhrase}"`}
              autoFocus
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-ink-200">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
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
