import { useState, useEffect } from 'react';
import { StatusDot } from '../ui/StatusDot';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-warn-bg border-b border-warn-border px-4 py-2.5 text-center text-xs font-semibold text-warn-text flex items-center justify-center gap-2"
    >
      <StatusDot tone="warn" pulse size={7} />
      <span>Working offline — your saved doses, records and emergency numbers still work.</span>
    </div>
  );
}
