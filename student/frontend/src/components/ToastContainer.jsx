import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function ToastContainer({ toasts = [], onDismiss }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl bg-white dark:bg-slate-800 shadow-xl border ${
              t.type === 'success'
                ? 'border-emerald-500/30 text-slate-800 dark:text-white'
                : t.type === 'error'
                ? 'border-red-500/30 text-slate-800 dark:text-white'
                : 'border-blue-500/30 text-slate-800 dark:text-white'
            }`}
          >
            {/* Icon */}
            <div className="shrink-0 mt-0.5">
              {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
              {t.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
              {t.type === 'info' && <Info className="w-5 h-5 text-blue-500" />}
            </div>

            {/* Message */}
            <div className="flex-1 text-xs sm:text-sm font-medium leading-snug">
              {t.message}
            </div>

            {/* Close Button */}
            <button
              onClick={() => onDismiss && onDismiss(t.id)}
              className="shrink-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
