import React from 'react';
import { Link } from 'react-router-dom';
import {
  Linkedin,
  Instagram,
  Youtube,
  Twitter,
  ArrowUp,
  Heart,
  Mail,
  Phone,
} from 'lucide-react';
import { footerColumns } from '../../data/navigation';
import { companyContacts } from '../../data/network';
import { playTone } from '../../utils/sound';

export default function Footer() {
  const scrollToTop = () => {
    playTone(600, 'sine', 0.05, 0.03);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="relative bg-slate-100 dark:bg-[#060911] border-t border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 text-xs sm:text-sm transition-colors">
      {/* Upper Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-8">
          
          {/* Brand Info Column */}
          <div className="md:col-span-4 flex flex-col items-start">
            <Link to="/" className="flex items-center gap-3 mb-4 group">
              <img
                src="/favicon.svg"
                alt="Nalanda Nexus Logo"
                className="w-10 h-10 rounded-full object-cover shadow ring-1 ring-slate-300 dark:ring-white/20 group-hover:scale-105 transition-transform"
              />
              <div className="flex flex-col">
                <span className="font-heading font-bold text-lg text-slate-900 dark:text-white tracking-tight">
                  Nalanda <span className="text-cyan-600 dark:text-cyan-400">Nexus</span>
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 -mt-1 tracking-wider">
                  Learn. Create. Connect.
                </span>
              </div>
            </Link>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-sm mb-4">
              Empowering the next generation to communicate, compute and create for a better tomorrow.
            </p>

            {/* Official Company Contacts */}
            <div className="space-y-1.5 mb-6 text-xs text-slate-700 dark:text-slate-300 font-medium">
              <a
                href={`mailto:${companyContacts.email}`}
                className="flex items-center gap-2 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
              >
                <Mail className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>{companyContacts.email}</span>
              </a>
              <a
                href="tel:+918630996363"
                className="flex items-center gap-2 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>{companyContacts.primaryPhone} / {companyContacts.secondaryPhone}</span>
              </a>
            </div>

            {/* Social Icons */}
            <div className="flex items-center gap-2.5">
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-lg bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 hover:border-cyan-500/50 shadow-sm transition-all"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-4 h-4" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-lg bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 hover:border-purple-500/50 shadow-sm transition-all"
                aria-label="Instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-lg bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 hover:border-rose-500/50 shadow-sm transition-all"
                aria-label="YouTube"
              >
                <Youtube className="w-4 h-4" />
              </a>
              <a
                href="https://x.com"
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-lg bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 hover:border-cyan-500/50 shadow-sm transition-all"
                aria-label="X (Twitter)"
              >
                <Twitter className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* 4 Link Columns: Platform, Resources, Community, Company */}
          <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-4">
            {footerColumns.map((col) => (
              <div key={col.title}>
                <h4 className="font-heading font-semibold text-sm text-slate-900 dark:text-white mb-3 tracking-wide">
                  {col.title}
                </h4>
                <ul className="space-y-2 text-xs">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        to={link.path}
                        className="text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-300 transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Bottom Copyright Bar */}
      <div className="border-t border-slate-200 dark:border-white/5 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            &copy; 2026 Nalanda Nexus. All rights reserved.
          </p>

          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
              Made with <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> for learners worldwide.
            </span>

            {/* Back to Top Button */}
            <button
              onClick={scrollToTop}
              className="w-8 h-8 rounded-lg bg-blue-600/20 hover:bg-blue-600 border border-blue-500/40 text-blue-700 dark:text-cyan-300 hover:text-white flex items-center justify-center transition-all shadow-sm"
              title="Back to Top"
              aria-label="Back to Top"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
