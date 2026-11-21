import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, BookOpen, Layers } from 'lucide-react';

/** Informational landing-page modal. Course video playback now lives per module. */
export default function PrarambhModal({ isOpen, onClose }) {
  useEffect(() => {
    const close = (event) => event.key === 'Escape' && onClose();
    if (isOpen) window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [isOpen, onClose]);
  if (!isOpen) return null;
  return <AnimatePresence><div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/85 backdrop-blur-xl" /><motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/15 bg-[#0D1424] text-white shadow-2xl">
    <div className="flex items-center justify-between border-b border-white/10 bg-[#0A1020] px-6 py-4"><div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-xl border border-purple-500/40 bg-purple-500/20 text-purple-300"><Sparkles className="w-4 h-4" /></span><div><h3 className="font-heading font-bold">PRARAMBH — Where the Journey Begins</h3><p className="text-xs text-slate-400">The Genesis and Philosophy of Nalanda Nexus</p></div></div><button onClick={onClose} aria-label="Close modal" className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X className="w-4 h-4" /></button></div>
    <div className="space-y-5 p-7"><div className="rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-[#172444] to-[#101728] p-6"><BookOpen className="mb-3 w-7 h-7 text-cyan-400" /><h4 className="font-heading font-bold text-lg">A course built module by module</h4><p className="mt-2 text-sm leading-relaxed text-slate-300">PRARAMBH videos are now managed independently for each module by the teaching team. Open the course after enrolment to see the latest verified learning content.</p></div><div><h4 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Layers className="w-4 h-4 text-purple-400" />The PRARAMBH journey</h4><ul className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2"><li>Orientation & foundations</li><li>Mindset & self growth</li><li>Communication mastery</li><li>Goal setting & productivity</li><li>Real-world projects & capstone</li></ul></div></div>
  </motion.div></div></AnimatePresence>;
}
