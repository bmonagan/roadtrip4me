import { createContext, useContext, useCallback, useState, useRef, useEffect, type ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (options: { message: string; type?: ToastType }) => void;
  dismiss: (id: string) => void;
}

export const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  toast: () => {},
  dismiss: () => {},
});

let nextId = 0;
const genId = () => `toast-${++nextId}`;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    ({ message, type = 'info' }: { message: string; type?: ToastType }) => {
      const id = genId();
      setToasts((prev) => [...prev, { id, message, type }]);
      const timer = window.setTimeout(() => dismiss(id), 4000);
      timers.current.set(id, timer);
    },
    [dismiss]
  );

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      timers.current.forEach((timer) => clearTimeout(timer));
      timers.current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
