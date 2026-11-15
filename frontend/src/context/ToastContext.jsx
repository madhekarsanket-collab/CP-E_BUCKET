import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);
const TOAST_MS = 4500;
const ICONS = { success: CheckCircle2, error: AlertTriangle, info: Info };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const notify = useCallback((message, tone = 'success') => {
    const id = nextId.current++;
    setToasts((all) => [...all.slice(-3), { id, message, tone }]);
    setTimeout(() => dismiss(id), TOAST_MS);
  }, [dismiss]);

  const value = useMemo(() => ({
    success: (message) => notify(message, 'success'),
    error: (message) => notify(message, 'error'),
    info: (message) => notify(message, 'info'),
  }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map(({ id, message, tone }) => {
          const Icon = ICONS[tone];
          return (
            <div key={id} className={`toast toast-${tone}`}>
              <Icon size={20} aria-hidden="true" />
              <p>{message}</p>
              <button type="button" className="icon-btn icon-btn-sm" onClick={() => dismiss(id)} aria-label="Dismiss message">
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
