import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warn';
}

let toastListener: ((toast: ToastMessage) => void) | null = null;

export const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warn' = 'info') => {
  if (toastListener) {
    toastListener({
      id: Math.random().toString(),
      message,
      type
    });
  }
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    toastListener = (newToast) => {
      setToasts(prev => [...prev, newToast]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== newToast.id));
      }, 3500);
    };
    return () => {
      toastListener = null;
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
      {toasts.map(t => {
        const bgMap = {
          success: 'bg-[#27805B] text-white border-[#1E6849]',
          error: 'bg-[#C43D4B] text-white border-[#A82D3B]',
          warn: 'bg-[#C58A24] text-white border-[#B27B1E]',
          info: 'bg-[#163B5C] text-white border-[#0E2A44]'
        };

        const Icon = t.type === 'success' ? CheckCircle2 : t.type === 'error' ? AlertCircle : Info;

        return (
          <div
            key={t.id}
            className={`
              pointer-events-auto flex items-center justify-between p-3 rounded-xl border shadow-xl text-xs font-semibold
              animate-fade-in ${bgMap[t.type]}
            `}
          >
            <div className="flex items-center gap-2.5">
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{t.message}</span>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="p-1 hover:opacity-75 transition-opacity"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
