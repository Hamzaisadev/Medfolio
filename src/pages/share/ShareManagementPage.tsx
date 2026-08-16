import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { Toast } from '../../components/ui/Toast';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { generateQrSvgUrl } from '../../lib/qr/qrGenerator';
import {
  forgetShareToken,
  generateShareToken,
  hashShareToken,
  recallShareToken,
  rememberShareToken,
} from '../../lib/security/shareToken';
import { sharesRepo } from '../../lib/db';
import type { Tables } from '../../lib/supabase/types';

import { useAuth } from '../../lib/auth/AuthContext';

export function ShareManagementPage() {
  const { user, profile } = useAuth();
  const [shares, setShares] = useState<Tables<'shares'>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [expiryOption, setExpiryOption] = useState<'24h' | '7d' | '30d'>('7d');
  const [isCreating, setIsCreating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeQrModal, setActiveQrModal] = useState<Tables<'shares'> | null>(null);

  const effectiveUserId = user?.id || profile?.user_id || '';
  const effectiveProfileId = profile?.id || effectiveUserId;

  const loadShares = useCallback(async () => {
    if (!effectiveProfileId) return;
    setIsLoading(true);
    try {
      // Shares are stored per profile, so they must be queried by profile id.
      const list = await sharesRepo.listShares(effectiveProfileId);
      setShares(list);
    } catch (err) {
      console.error('Failed to load shares:', err);
      setToastMessage('Could not load your share links.');
    } finally {
      setIsLoading(false);
    }
  }, [effectiveProfileId]);

  useEffect(() => {
    loadShares();
  }, [loadShares]);

  const handleCreateShare = async () => {
    setIsCreating(true);
    try {
      // Only the hash is persisted; the raw token stays on this device.
      const token = generateShareToken();
      const tokenHash = await hashShareToken(token);
      const now = new Date();

      const hours = expiryOption === '24h' ? 24 : expiryOption === '7d' ? 24 * 7 : 24 * 30;
      const expiryDate = new Date(now.getTime() + hours * 60 * 60 * 1000);

      const created = await sharesRepo.createShareRecord({
        user_id: effectiveUserId,
        profile_id: effectiveProfileId,
        token_hash: tokenHash,
        snapshot: { created_at: now.toISOString() },
        expires_at: expiryDate.toISOString(),
      });

      rememberShareToken(created.id, token);

      setToastMessage('Share link created.');
      setIsCreateOpen(false);
      await loadShares();
    } catch (err) {
      console.error('Create share error:', err);
      setToastMessage('Failed to create share link.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await sharesRepo.revokeShare(id);
      forgetShareToken(id);
      setToastMessage('Share link revoked immediately.');
      await loadShares();
    } catch (err) {
      console.error('Revoke error:', err);
      setToastMessage(
        err instanceof Error ? err.message : 'Failed to revoke share link. It may still be active.'
      );
    }
  };

  const getShareUrl = (shareId: string): string | null => {
    const token = recallShareToken(shareId);
    return token ? `${window.location.origin}/share/${token}` : null;
  };

  const handleCopyLink = async (shareId: string) => {
    const url = getShareUrl(shareId);
    if (!url) {
      setToastMessage('This link was created on another device, so it cannot be shown here.');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setToastMessage('Link copied to clipboard.');
    } catch {
      setToastMessage('Could not access the clipboard. Copy the link shown in the QR dialog.');
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Doctor Share Links"
        description="Generate temporary, view-only links or QR codes allowing doctors to inspect your medical brief."
        action={
          <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
            + Create Share Link
          </Button>
        }
      />

      <Toast
        open={Boolean(toastMessage)}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
        tone="ok"
      />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : shares.length === 0 ? (
        <EmptyState
          heading="No share links active"
          description="Create your first share link or QR code to let your doctor view your active medication list and health history."
          action={
            <Button size="sm" onClick={() => setIsCreateOpen(true)}>
              Create Share Link
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {shares.map((share) => {
            const isRevoked = Boolean(share.revoked_at);
            const isExpired = new Date(share.expires_at) < new Date();
            const isActive = !isRevoked && !isExpired;
            const hasLocalToken = Boolean(recallShareToken(share.id));

            return (
              <Card key={share.id} className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-sm font-bold text-ink-900 bg-ink-100 px-2 py-0.5 rounded">
                        Doctor link · {share.view_count} view{share.view_count === 1 ? '' : 's'}
                      </span>
                      {isActive ? (
                        <Badge tone="ok">Active</Badge>
                      ) : isRevoked ? (
                        <Badge tone="risk">Revoked</Badge>
                      ) : (
                        <Badge tone="warn">Expired</Badge>
                      )}
                    </div>
                    <p className="text-xs text-ink-500">
                      Expires: {new Date(share.expires_at).toLocaleString()} • Created:{' '}
                      {new Date(share.created_at).toLocaleDateString()}
                    </p>
                    {isActive && !hasLocalToken && (
                      <p className="text-xs text-amber-700">
                        Created on another device — you can revoke it here, but the link itself
                        cannot be shown again.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {isActive && (
                      <>
                        {hasLocalToken && (
                          <>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleCopyLink(share.id)}
                            >
                              Copy Link
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setActiveQrModal(share)}
                            >
                              Show QR Code
                            </Button>
                          </>
                        )}
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleRevoke(share.id)}
                        >
                          Revoke
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Share Modal */}
      <Dialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        title="Create Doctor Share Link"
        description="Share a temporary read-only view of your active medications, allergies, and recent health history."
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-ink-700 block mb-2">Link Expiry Duration</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: '24h' as const, label: '24 Hours', desc: 'Emergency / 1 visit' },
                { id: '7d' as const, label: '7 Days', desc: 'Consultation & follow-up' },
                { id: '30d' as const, label: '30 Days', desc: 'Hospital treatment' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setExpiryOption(opt.id)}
                  className={`p-3 rounded-md border text-left transition-all ${
                    expiryOption === opt.id
                      ? 'border-teal-600 bg-teal-50/50 ring-2 ring-teal-200'
                      : 'border-ink-200 bg-white hover:bg-ink-50'
                  }`}
                >
                  <span className="text-xs font-bold text-ink-900 block">{opt.label}</span>
                  <span className="text-[10px] text-ink-500 block mt-0.5">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 bg-ink-50 rounded text-xs text-ink-600 leading-relaxed">
            Doctors opening this link will see your Doctor Brief without creating an account. You can revoke access at any time with immediate effect.
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateShare} loading={isCreating}>
              Generate Share Link
            </Button>
          </div>
        </div>
      </Dialog>

      {/* QR Code Lightbox */}
      {activeQrModal && (() => {
        const shareUrl = getShareUrl(activeQrModal.id);
        return (
          <Dialog
            open={Boolean(activeQrModal)}
            onOpenChange={(open) => !open && setActiveQrModal(null)}
            title="Doctor Scan QR Code"
            description="Have your doctor scan this code directly with their phone camera to view your brief."
          >
            <div className="flex flex-col items-center justify-center p-4 space-y-4">
              {shareUrl ? (
                <>
                  <div className="p-4 bg-white border border-ink-200 rounded-xl shadow-md">
                    <img
                      src={generateQrSvgUrl(shareUrl, 220)}
                      alt="QR code for doctor share"
                      className="w-52 h-52 object-contain"
                    />
                  </div>

                  <p className="font-mono text-[11px] break-all text-center text-ink-700 bg-ink-100 px-3 py-1.5 rounded-lg">
                    {shareUrl}
                  </p>

                  <p className="text-[11px] text-ink-500 text-center">
                    Anyone with this link can read the brief until it expires or you revoke it.
                  </p>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleCopyLink(activeQrModal.id)}
                  >
                    Copy Link to Clipboard
                  </Button>
                </>
              ) : (
                <p className="text-sm text-ink-600 text-center py-6">
                  This link was created on another device. For security the link is never stored on
                  our servers, so it cannot be displayed again here — revoke it and create a new one.
                </p>
              )}
            </div>
          </Dialog>
        );
      })()}
    </AppShell>
  );
}
