import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Shared modal shell (header + close button + scrollable body) used by every
 * "create X" flow (class, course, exam, assignment, session) so each page
 * doesn't reimplement its own overlay/panel/escape-key handling.
 */
export default function Modal({ isOpen, onClose, title, icon: Icon, children, maxWidth = 'max-w-lg' }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidth} bg-[#131B2E] border border-[#243354] rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 bg-[#0F1626] border-b border-[#243354] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <div className="w-9 h-9 rounded-xl bg-[#C99A2E]/15 border border-[#C99A2E]/40 flex items-center justify-center text-[#C99A2E] flex-shrink-0">
                <Icon className="w-4.5 h-4.5" />
              </div>
            )}
            <h3 className="text-base font-bold text-[#EDEAE0] font-display truncate">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#9B9690] hover:text-[#EDEAE0] hover:bg-[#182238] transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function FormField({ label, children, error }) {
  return (
    <div>
      <label className="text-xs font-semibold text-[#9B9690] block mb-1">{label}</label>
      {children}
      {error && <p className="text-[11px] text-[#D95248] mt-1">{error}</p>}
    </div>
  );
}

export const inputClass =
  'w-full bg-[#0B101B] border border-[#243354] rounded-xl px-3 py-2 text-xs text-[#EDEAE0] focus:outline-none focus:border-[#C99A2E] disabled:opacity-50';
