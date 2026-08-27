import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, ArrowLeft } from 'lucide-react';

/**
 * Real 404 page.
 *
 * Unknown URLs previously redirected straight to Home, which quietly told the
 * visitor nothing was wrong: a mistyped or dead link looked like it had
 * worked, and search engines saw a 200 + homepage for every bad URL (a soft
 * 404, which suppresses indexing). Showing the failure - and offering the way
 * back - is both clearer for people and correct for crawlers.
 */
export default function NotFound() {
  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 sm:px-6 py-16 bg-[#EDEAE0] dark:bg-[#0B111F]">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-[#22355E]/10 dark:bg-white/10 flex items-center justify-center mb-5">
          <Compass className="w-7 h-7 text-[#22355E] dark:text-cyan-300" aria-hidden="true" />
        </div>

        <p className="font-mono text-xs tracking-[0.18em] uppercase text-[#AB5236] dark:text-amber-400 mb-2">
          Error 404
        </p>

        <h1 className="font-heading font-bold text-2xl sm:text-3xl text-[#22355E] dark:text-white mb-3">
          This page doesn&rsquo;t exist
        </h1>

        <p className="text-sm text-slate-600 dark:text-slate-400 mb-7">
          The link may be out of date, or the address may have a typo. Nothing has gone wrong with
          your account.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-full bg-[#22355E] text-white text-sm font-semibold hover:bg-[#2c4275] transition-colors w-full sm:w-auto"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Back to home
          </Link>
          <Link
            to="/learn"
            className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-full border border-[#DFDACB] dark:border-white/15 text-[#22355E] dark:text-slate-200 text-sm font-semibold hover:bg-white/60 dark:hover:bg-white/5 transition-colors w-full sm:w-auto"
          >
            Browse courses
          </Link>
        </div>
      </div>
    </main>
  );
}
