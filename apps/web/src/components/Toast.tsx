import React, { useState, createContext, useContext, useCallback } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

interface ToastMessage {
  id: string;
  type: 'error' | 'success' | 'info';
  message: string;
  duration?: number;
}

interface ToastContextType {
  error: (message: string, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: 'error' | 'success' | 'info', duration = 5000) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type, duration }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
  }, []);

  const value: ToastContextType = {
    error: (msg, duration) => showToast(msg, 'error', duration),
    success: (msg, duration) => showToast(msg, 'success', duration),
    info: (msg, duration) => showToast(msg, 'info', duration),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onRemove={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div
      style={{
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        maxWidth: '400px',
      }}
    >
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          type={toast.type}
          message={toast.message}
          onRemove={() => onRemove(toast.id)}
        />
      ))}
    </div>
  );
}

interface ToastProps {
  type: 'error' | 'success' | 'info';
  message: string;
  onRemove: () => void;
}

function Toast({ type, message, onRemove }: ToastProps) {
  const bgColor = {
    error: '#FFF5F0',
    success: '#F0FDF4',
    info: '#F0F9FF',
  }[type];

  const borderColor = {
    error: '#FFB8A0',
    success: '#86EFAC',
    info: '#A5D6FF',
  }[type];

  const iconColor = {
    error: '#F27D26',
    success: '#22C55E',
    info: '#0EA5E9',
  }[type];

  const Icon = {
    error: AlertCircle,
    success: CheckCircle2,
    info: Info,
  }[type];

  return (
    <div
      style={{
        backgroundColor: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: '0.5rem',
        padding: '1rem',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        animation: 'slideIn 0.3s ease-out',
      }}
    >
      <Icon style={{ width: '1.25rem', height: '1.25rem', color: iconColor, flexShrink: 0, marginTop: '0.125rem' }} />
      <div style={{ flex: 1, fontSize: '0.875rem', color: '#333' }}>
        {message}
      </div>
      <button
        onClick={onRemove}
        style={{
          background: 'none',
          border: 'none',
          padding: '0.25rem',
          cursor: 'pointer',
          color: '#999',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <X style={{ width: '1rem', height: '1rem' }} />
      </button>

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
