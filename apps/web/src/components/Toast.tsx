import { useEffect } from 'react';
import type { Toast } from '../lib/useToast';

const icons: Record<string, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

export default function Toast({ toast: t, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className={`toast toast-${t.type}`} role="alert">
      <span className="toast-icon">{icons[t.type]}</span>
      <span className="toast-message">{t.message}</span>
      <button type="button" className="toast-close" onClick={onDismiss} aria-label="Dismiss notification">
        ×
      </button>
    </div>
  );
}
