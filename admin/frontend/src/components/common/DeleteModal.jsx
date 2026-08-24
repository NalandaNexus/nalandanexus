import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, Trash2 } from 'lucide-react';

export default function DeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Delete Item?',
  description = 'This will permanently remove this record and all associated permissions.',
  itemName,
  confirmText = 'DELETE',
  isDeleting = false,
}) {
  const [typedConfirm, setTypedConfirm] = useState('');
  const isMatch = typedConfirm.trim().toUpperCase() === confirmText.toUpperCase();

  useEffect(() => {
    if (isOpen) {
      setTypedConfirm('');
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isDeleting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDeleting, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isMatch && !isDeleting) {
      onConfirm();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#22355E]/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white border border-[#DFDACB] rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isDeleting}
          className="absolute right-4 top-4 p-1.5 rounded-lg text-[#9B9690] hover:text-[#2B2B28] hover:bg-[#EDEAE0] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header with Danger Icon */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#C1352B]/10 border border-[#C1352B]/30 flex items-center justify-center text-[#C1352B] flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#22355E]">{title}</h3>
            <p className="text-xs text-[#9B9690]">Irreversible Administrative Action</p>
          </div>
        </div>

        <p className="text-xs text-[#2B2B28] leading-relaxed mb-3">
          {description}
        </p>

        {itemName && (
          <div className="p-2.5 bg-[#EDEAE0] rounded-xl border border-[#DFDACB] text-xs font-semibold text-[#22355E] mb-4 truncate font-mono">
            {itemName}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#2B2B28] mb-1.5">
              Type <span className="font-mono font-bold text-[#C1352B] bg-[#C1352B]/10 px-1.5 py-0.5 rounded">{confirmText}</span> to confirm:
            </label>
            <input
              type="text"
              required
              autoFocus
              value={typedConfirm}
              onChange={(e) => setTypedConfirm(e.target.value)}
              placeholder={confirmText}
              className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs font-mono text-[#2B2B28] placeholder-[#9B9690] focus:outline-none focus:border-[#C1352B] focus:ring-1 focus:ring-[#C1352B]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EDEAE0]">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 rounded-xl bg-[#EDEAE0] hover:bg-[#DFDACB] text-[#2B2B28] text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isMatch || isDeleting}
              className="px-4 py-2 rounded-xl bg-[#C1352B] hover:bg-[#A32B22] text-white text-xs font-semibold transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Confirm Delete</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
