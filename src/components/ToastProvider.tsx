import React, { createContext, useCallback, useContext, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'info' | 'error';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ShowToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
}

interface ToastContextValue {
  showToast: (input: ShowToastInput) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ title, description, variant = 'success', durationMs = 5200 }: ShowToastInput) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, title, description, variant }]);
      if (durationMs > 0 && typeof window !== 'undefined') {
        window.setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, durationMs);
      }
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}

      {/* Floating Accessible Toast Stack */}
      <div
        aria-live="polite"
        aria-atomic="false"
        data-testid="toast-viewport"
        className="no-print fixed bottom-5 left-4 z-[90] w-[calc(100vw-2rem)] max-w-sm flex flex-col gap-2.5 pointer-events-none"
      >
        {toasts.map((item) => {
          const isSuccess = item.variant === 'success';
          const isError = item.variant === 'error';
          return (
            <div
              key={item.id}
              role="status"
              data-testid="toast-notification"
              className={`pointer-events-auto rounded-xl border shadow-lg px-4 py-3.5 flex items-start gap-3 ${
                isSuccess
                  ? 'bg-[#08184B] text-white border-[#D9A726]/65'
                  : isError
                    ? 'bg-[#A81C1C] text-white border-red-300/40'
                    : 'bg-white text-[#08184B] border-[#08184B]/20'
              }`}
            >
              {isSuccess ? (
                <CheckCircle2
                  className="h-5 w-5 text-[#EAB308] shrink-0 mt-0.5"
                  aria-hidden="true"
                />
              ) : isError ? (
                <AlertCircle className="h-5 w-5 text-white shrink-0 mt-0.5" aria-hidden="true" />
              ) : (
                <Info className="h-5 w-5 text-[#08184B] shrink-0 mt-0.5" aria-hidden="true" />
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold leading-snug">{item.title}</p>
                {item.description && (
                  <p
                    className={`text-xs mt-0.5 leading-relaxed ${
                      isSuccess || isError ? 'text-white/85' : 'text-[#08184B]/75'
                    }`}
                  >
                    {item.description}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => dismissToast(item.id)}
                aria-label="Dismiss notification"
                className={`p-1 rounded-md shrink-0 cursor-pointer ${
                  isSuccess || isError
                    ? 'text-white/75 hover:text-white hover:bg-white/10'
                    : 'text-[#08184B]/60 hover:text-[#08184B] hover:bg-[#FAF8F4]'
                }`}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
