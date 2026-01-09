import React, { useEffect } from 'react';

interface ModalProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
  widthClassName?: string;
}

export const Modal: React.FC<ModalProps> = ({ open, title, onClose, footer, children, widthClassName }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 flex items-start justify-center pt-[10vh] px-4 sm:px-6">
        <div
          role="dialog"
          aria-modal="true"
          className={`card glass-heavy w-full ${widthClassName || 'max-w-xl'} animate-fade-in`}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <h3 className="text-lg font-semibold text-gray-100">{title}</h3>
            <button
              aria-label="Close"
              className="rounded-md px-2 py-1 hover:bg-white/10 text-gray-300"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
          <div className="px-5 py-4">
            {children}
          </div>
          {footer && (
            <div className="px-5 py-4 border-t border-white/10 flex items-center justify-end gap-2">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

