import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, BookOpen, Calendar, Sparkles, ExternalLink, Search, AlertCircle, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { playTone } from '../utils/sound';
import { resourceService } from '../services/resourceService';
import { connectPublicSocket } from '../services/socket';

const TYPES = [
  { id: 'all', label: 'All Resources', icon: Sparkles },
  { id: 'magazine', label: 'Magazines', icon: BookOpen },
  { id: 'event', label: 'Event Photos', icon: Calendar },
  { id: 'program', label: 'Program Resources', icon: FileText },
];

const TYPE_LABEL = { magazine: 'Magazine', event: 'Event Photo', program: 'Program Resource' };

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Real, backend-driven resources (magazines, event photos, program
 * materials) - see services/resourceService.js -> GET /api/public/resources.
 * No hardcoded copy: an empty/failed fetch shows an honest empty/error
 * state, never fake items. Live-updates as admin uploads via the public
 * socket namespace (services/socket.js#connectPublicSocket).
 */
export default function Resources() {
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get('type') || 'all';
  const [selectedType, setSelectedType] = useState(TYPES.some((t) => t.id === initialType) ? initialType : 'all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | success | empty | error

  const load = useCallback(() => {
    setStatus('loading');
    resourceService
      .listPublicResources({ type: selectedType, search, page, pageSize: 12 })
      .then((res) => {
        setItems(res.data || []);
        setMeta(res.meta || null);
        setStatus((res.data || []).length ? 'success' : 'empty');
      })
      .catch(() => setStatus('error'));
  }, [selectedType, search, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Live sync: an admin upload/edit/delete pushes over the public socket
  // namespace immediately after the write is confirmed - refetch the
  // current page rather than trying to splice the event payload in, since
  // pagination/search/type filters make "where does this item belong"
  // ambiguous from the event alone.
  const socketRef = useRef(null);
  useEffect(() => {
    const socket = connectPublicSocket();
    socketRef.current = socket;
    const onChange = () => load();
    socket.on('resource.upserted', onChange);
    socket.on('resource.deleted', onChange);
    return () => {
      socket.off('resource.upserted', onChange);
      socket.off('resource.deleted', onChange);
    };
  }, [load]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  return (
    <div className="min-h-screen pt-28 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-700 dark:text-cyan-300 text-xs font-semibold mb-4">
          <BookOpen className="w-3.5 h-3.5" />
          <span>MAGAZINES &amp; PROGRAM RESOURCES</span>
        </div>
        <h1 className="font-heading font-extrabold text-4xl sm:text-5xl text-slate-900 dark:text-white tracking-tight">
          Resources
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mt-3 leading-relaxed font-medium">
          Magazines, event highlights, and program materials published by Nalanda Nexus.
        </p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearchSubmit} className="max-w-md mx-auto mb-8">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search resources..."
            className="w-full pl-10 pr-4 py-2.5 rounded-full bg-slate-100 dark:bg-[#0D1424]/60 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
      </form>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-12">
        {TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              playTone(520, 'sine', 0.04, 0.02);
              setSelectedType(t.id);
              setPage(1);
            }}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold border transition-all inline-flex items-center gap-1.5 ${
              selectedType === t.id
                ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/30 scale-105'
                : 'bg-slate-100 dark:bg-[#0D1424]/60 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {status === 'loading' && (
        <div className="text-center py-16 text-sm text-slate-500 dark:text-slate-400">Loading resources…</div>
      )}

      {status === 'error' && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <AlertCircle className="w-6 h-6 text-red-500" />
          <span className="text-sm text-slate-600 dark:text-slate-400">Resources are unavailable right now.</span>
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-600 dark:text-cyan-400 hover:underline"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}

      {status === 'empty' && (
        <div className="text-center py-16 text-sm text-slate-500 dark:text-slate-400">
          No resources published yet{selectedType !== 'all' ? ` in "${TYPE_LABEL[selectedType]}"` : ''}. Check back soon.
        </div>
      )}

      {status === 'success' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {items.map((item, idx) => {
              const isImage = item.fileType?.startsWith('image/');
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: (idx % 12) * 0.06 }}
                  className="rounded-3xl bg-white/95 dark:bg-[#0D1424]/80 backdrop-blur-xl border border-slate-200/90 dark:border-white/15 hover:border-cyan-500/50 shadow-xl shadow-slate-200/50 dark:shadow-2xl flex flex-col justify-between transition-all hover:-translate-y-1 overflow-hidden"
                >
                  {isImage ? (
                    <img src={item.fileUrl} alt={item.title} className="w-full h-40 object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-40 bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                      <FileText className="w-10 h-10 text-slate-400 dark:text-slate-500" />
                    </div>
                  )}
                  <div className="p-6 flex flex-col justify-between flex-1">
                    <div>
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300">
                        {TYPE_LABEL[item.type] || item.type}
                      </span>
                      <h3 className="font-heading font-bold text-lg text-slate-900 dark:text-white mt-3 mb-2 leading-snug">
                        {item.title}
                      </h3>
                      {item.description && (
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium line-clamp-3">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-between">
                      <span className="text-xs text-slate-500 dark:text-slate-400">{formatFileSize(item.fileSizeBytes)}</span>
                      <a
                        href={item.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline"
                      >
                        <span>{isImage ? 'View' : 'Open'}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-12">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page <= 1}
                className="p-2 rounded-full border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-white/5"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Page {meta.page} of {meta.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, meta.totalPages))}
                disabled={page >= meta.totalPages}
                className="p-2 rounded-full border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-white/5"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
