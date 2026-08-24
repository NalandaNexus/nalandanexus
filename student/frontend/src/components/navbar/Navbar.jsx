import React, { useState, useEffect } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Search,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  Menu,
  X,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { navLinks } from '../../data/navigation';
import { playTone } from '../../utils/sound';
import { useAuth } from '../../context/AuthContext';
import SearchModal from '../common/SearchModal';
import MobileMenu from './MobileMenu';

export default function Navbar({
  soundOn = true,
  onToggleSound,
  darkMode = true,
  onToggleTheme,
}) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Scroll listener for sticky navbar appearance
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Global Ctrl/Cmd + K shortcut for search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSoundToggle = () => {
    playTone(660, 'sine', 0.08, 0.06);
    if (onToggleSound) onToggleSound();
  };

  const handleThemeToggle = () => {
    playTone(520, 'sine', 0.08, 0.06);
    if (onToggleTheme) onToggleTheme();
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          isScrolled
            ? 'glass-nav py-3.5 shadow-lg dark:shadow-[0_10px_30px_rgba(0,0,0,0.4)]'
            : 'bg-transparent py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* LEFT: Logo & Brand Tagline */}
          <Link
            to="/"
            className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-xl p-1"
          >
            <div className="relative">
              <img
                src="/favicon.svg"
                alt="Nalanda Nexus Logo"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover shadow-lg shadow-blue-900/20 ring-1 ring-slate-200 dark:ring-white/20 group-hover:scale-105 transition-transform"
              />
              <div className="absolute -inset-1 rounded-full bg-cyan-400/20 blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-heading font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white">
                  Nalanda <span className="text-cyan-600 dark:text-cyan-400">Nexus</span>
                </span>
              </div>
              <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-slate-400 -mt-1 tracking-wider">
                Learn. Create. Connect.
              </span>
            </div>
          </Link>

          {/* CENTER: Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-100/90 dark:bg-[#0D1424]/70 border border-slate-200/80 dark:border-white/10 backdrop-blur-md shadow-sm">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <NavLink
                  key={link.path}
                  to={link.path}
                  className={({ isActive }) =>
                    `relative px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-blue-600/15 dark:bg-blue-600/30 text-blue-600 dark:text-white font-semibold shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/5'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span>{link.label}</span>
                      {isActive && (
                        <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-gradient-to-r from-purple-500 via-cyan-400 to-orange-400 rounded-full" />
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* RIGHT: Action Tools & Auth Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Search Icon */}
            <button
              onClick={() => {
                playTone(500, 'sine', 0.05, 0.04);
                setIsSearchOpen(true);
              }}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 hover:scale-105 transition-all shadow-sm"
              title="Search (Ctrl + K)"
              aria-label="Open search dialog"
            >
              <Search className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            </button>

            {/* Theme Toggle */}
            <button
              onClick={handleThemeToggle}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 hover:scale-105 transition-all shadow-sm"
              title={darkMode ? 'Switch to Light mode' : 'Switch to Dark mode'}
              aria-label="Toggle dark/light theme"
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600" />
              )}
            </button>

            {/* Sound Toggle */}
            <button
              onClick={handleSoundToggle}
              className="hidden sm:flex w-9 h-9 rounded-full items-center justify-center bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 hover:scale-105 transition-all shadow-sm"
              title={soundOn ? 'Mute sound effects' : 'Enable sound effects'}
              aria-label="Toggle audio effects"
            >
              {soundOn ? (
                <Volume2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              )}
            </button>

            {isAuthenticated ? (
              /* Auth: signed-in students go straight to their dashboard */
              <Link
                to="/student/dashboard"
                className="hidden sm:inline-flex items-center justify-center px-4 py-1.5 rounded-full text-xs font-semibold text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-md shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all hover:scale-105"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                {/* Auth: Log In Button */}
                <Link
                  to="/login"
                  className="hidden md:inline-flex items-center justify-center px-4 py-1.5 rounded-full text-xs font-semibold text-slate-800 dark:text-white border border-slate-300 dark:border-white/20 hover:border-slate-400 dark:hover:border-white/40 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-all hover:scale-105 shadow-sm"
                >
                  Log In
                </Link>

                {/* Auth: Sign Up Button */}
                <Link
                  to="/signup"
                  className="hidden sm:inline-flex items-center justify-center px-4 py-1.5 rounded-full text-xs font-semibold text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-md shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all hover:scale-105"
                >
                  Sign Up
                </Link>
              </>
            )}

            {/* Mobile Hamburger Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden w-9 h-9 rounded-full flex items-center justify-center bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white"
              aria-label="Open mobile menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Global Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />

      {/* Mobile Drawer Menu */}
      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        soundOn={soundOn}
        onToggleSound={handleSoundToggle}
        darkMode={darkMode}
        onToggleTheme={handleThemeToggle}
        onOpenSearch={() => setIsSearchOpen(true)}
      />
    </>
  );
}
