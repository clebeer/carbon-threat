import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

export type ToastVariant = 'info' | 'success' | 'error';

export interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  /** Show a toast. Auto-dismisses after `duration` ms (default 4000). */
  notify: (message: string, variant?: ToastVariant, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const COLORS: Record<ToastVariant, string> = {
  info: 'var(--primary)',
  success: 'var(--success)',
  error: 'var(--error)',
};

/** Wrap the app once (e.g. in main.tsx) to enable useToast() anywhere below. */
export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback((message: string, variant: ToastVariant = 'info', duration = 4000) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, variant }]);
    if (duration > 0) setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        style={{ position: 'fixed', bottom: 'var(--space-6)', right: 'var(--space-6)', zIndex: 1100, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="glass-panel"
            style={{
              minWidth: 240,
              maxWidth: 380,
              padding: 'var(--space-3) var(--space-4)',
              borderLeft: `3px solid ${COLORS[t.variant]}`,
              color: 'var(--on-surface)',
              fontSize: 'var(--text-sm)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 'var(--space-3)',
              animation: 'ct-toast-in 0.2s ease',
            }}
          >
            <span>{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              style={{ background: 'transparent', border: 'none', color: 'var(--on-surface-muted)', cursor: 'pointer', fontSize: 'var(--text-md)', lineHeight: 1 }}
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

/** Access the toast API. Must be used within a <ToastProvider>. */
export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
};
