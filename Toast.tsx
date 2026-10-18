import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type Kind = 'info' | 'error';
interface ToastItem { id: number; message: string; kind: Kind }
interface ToastValue { toast: (message: string, kind?: Kind) => void }

const ToastContext = createContext<ToastValue | null>(null);
let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, kind: Kind = 'info') => {
    const id = nextId++;
    setItems((list) => [...list.slice(-3), { id, message, kind }]);
    window.setTimeout(() => setItems((list) => list.filter((i) => i.id !== id)), 4500);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6" role="status" aria-live="polite">
        {items.map((i) => (
          <div
            key={i.id}
            className={`pointer-events-auto max-w-md rounded-xl px-4 py-2.5 text-sm shadow-lg ${
              i.kind === 'error' ? 'bg-red-600 text-white' : 'bg-zinc-900 text-white'
            }`}
          >
            {i.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
