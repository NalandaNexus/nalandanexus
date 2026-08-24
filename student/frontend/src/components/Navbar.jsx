import React from 'react';
import { Volume2, VolumeX, Sun, Moon } from 'lucide-react';
import { playTone } from '../utils/sound';

export default function Navbar({ soundOn, onToggleSound, darkMode, onToggleTheme }) {
  const handleSoundClick = () => {
    playTone(660, 'sine', 0.08, 0.06);
    onToggleSound();
  };

  const handleThemeClick = () => {
    playTone(520, 'sine', 0.08, 0.06);
    onToggleTheme();
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-md bg-white/40 dark:bg-slate-900/40 border-b border-slate-200/50 dark:border-slate-800/50 transition-colors">
      <div className="flex items-center gap-3">
        <img
          src="favicon.svg"
          alt="Nalanda Nexus Logo"
          className="w-8 h-8 rounded-full object-cover shadow-md shadow-blue-900/20 ring-1 ring-white/50"
        />
        <span className="font-heading font-bold text-sm sm:text-base tracking-tight text-slate-800 dark:text-slate-100">
          Nalanda Nexus
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Sound Toggle */}
        <button
          onClick={handleSoundClick}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:scale-105 transition-all shadow-sm"
          title={soundOn ? 'Mute sound effects' : 'Enable sound effects'}
          aria-label="Toggle sound"
        >
          {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
        </button>

        {/* Theme Toggle */}
        <button
          onClick={handleThemeClick}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:scale-105 transition-all shadow-sm"
          title={darkMode ? 'Switch to Light mode' : 'Switch to Dark mode'}
          aria-label="Toggle theme"
        >
          {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
        </button>
      </div>
    </header>
  );
}
