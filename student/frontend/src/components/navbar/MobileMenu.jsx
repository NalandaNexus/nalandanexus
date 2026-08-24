import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Moon, Sun, Volume2, VolumeX, ArrowRight } from 'lucide-react';
import { navLinks } from '../../data/navigation';
import { useAuth } from '../../context/AuthContext';

export default function MobileMenu({
  isOpen,
  onClose,
  soundOn,
  onToggleSound,
  darkMode,
  onToggleTheme,
  onOpenSearch,
}) {
  const { isAuthenticated } = useAuth();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 lg:hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Drawer Panel */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed top-0 right-0 bottom-0 w-full max-w-xs bg-white dark:bg-[#0D1424] border-l border-slate-200 dark:border-white/10 p-6 flex flex-col justify-between shadow-2xl text-slate-900 dark:text-white z-10 overflow-y-auto"
        >
          <div>
            {/* Header */}
            <div className="flex items-center justify-between pb-5 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <img
                  src="/favicon.svg"
                  alt="Nalanda Nexus Logo"
                  className="w-8 h-8 rounded-full object-cover shadow"
                />
                <span className="font-heading font-bold text-base tracking-tight text-slate-900 dark:text-white">
                  Nalanda <span className="text-cyan-600 dark:text-cyan-400">Nexus</span>
                </span>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Tools */}
            <div className="grid grid-cols-3 gap-2 my-4">
              <button
                onClick={() => {
                  onClose();
                  onOpenSearch();
                }}
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                title="Search"
              >
                <Search className="w-4 h-4 text-cyan-600 dark:text-cyan-400 mb-1" />
                <span className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">Search</span>
              </button>

              <button
                onClick={onToggleTheme}
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                title="Theme"
              >
                {darkMode ? (
                  <Sun className="w-4 h-4 text-amber-400 mb-1" />
                ) : (
                  <Moon className="w-4 h-4 text-indigo-600 mb-1" />
                )}
                <span className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">{darkMode ? 'Light' : 'Dark'}</span>
              </button>

              <button
                onClick={onToggleSound}
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                title="Sound FX"
              >
                {soundOn ? (
                  <Volume2 className="w-4 h-4 text-purple-600 dark:text-purple-400 mb-1" />
                ) : (
                  <VolumeX className="w-4 h-4 text-slate-400 dark:text-slate-500 mb-1" />
                )}
                <span className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">{soundOn ? 'Sound On' : 'Mute'}</span>
              </button>
            </div>

            {/* Navigation links */}
            <nav className="flex flex-col gap-1 mt-2">
              {navLinks.map((link) => (
                <NavLink
                  key={link.path}
                  to={link.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-blue-600/10 dark:bg-cyan-500/15 border border-blue-600/30 dark:border-cyan-500/30 text-blue-600 dark:text-white font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                    }`
                  }
                >
                  <span>{link.label}</span>
                  <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Auth Action Buttons */}
          <div className="pt-6 border-t border-slate-200 dark:border-white/10 flex flex-col gap-2.5">
            {isAuthenticated ? (
              <Link
                to="/student/dashboard"
                onClick={onClose}
                className="w-full flex items-center justify-center py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 shadow-md shadow-indigo-600/30 hover:scale-102 transition-transform"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={onClose}
                  className="w-full flex items-center justify-center py-2.5 rounded-xl text-sm font-semibold text-slate-800 dark:text-white border border-slate-300 dark:border-white/20 bg-slate-100 dark:bg-transparent hover:bg-slate-200 dark:hover:bg-white/10 transition-colors shadow-sm"
                >
                  Log In
                </Link>
                <Link
                  to="/signup"
                  onClick={onClose}
                  className="w-full flex items-center justify-center py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 shadow-md shadow-indigo-600/30 hover:scale-102 transition-transform"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
