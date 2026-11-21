import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, RefreshCw, AlertTriangle, XCircle, Info } from 'lucide-react';
import { formatWhen } from './videoFormat';

/**
 * The video history: who uploaded, replaced, published or removed which
 * module's video, and every failure - uploads that failed verification or
 * were abandoned, files that could not be cleaned up, links that stopped
 * working. Read from the student service's own log, so it covers changes made
 * from either portal.
 *
 * Copied byte for byte into the Admin portal (see LessonVideoEditor.jsx).
 */

const ACTION_TEXT = {
  link_saved: 'saved the video as a draft',
  published: 'published a video',
  unpublished: 'unpublished the video',
  removed: 'removed the video',
  upload_started: 'started uploading',
  upload_completed: 'uploaded',
  upload_failed: 'upload failed',
  upload_aborted: 'cancelled an upload',
  upload_expired: 'upload abandoned',
  upload_conflict: 'upload verified but not attached',
  object_deleted: 'replaced file deleted from storage',
  object_cleanup_failed: 'could not delete a replaced file',
  availability_changed: 'availability changed',
};
const LEVEL = {
  error: { Icon: XCircle, cls: 'text-[#9A2820] bg-[#C1352B]/10' },
  warn: { Icon: AlertTriangle, cls: 'text-[#7A5B12] bg-[#C99A2E]/10' },
  info: { Icon: Info, cls: 'text-[#22355E] bg-[#22355E]/5' },
};

export default function VideoActivityPanel({ title, load, labelFor, refreshSignal, emptyText = 'Nothing yet.', defaultOpen = false, showCourse = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Callers pass a fresh function each render; only opening, the refresh
  // button and refreshSignal trigger a read.
  const loadRef = useRef(load);
  loadRef.current = load;

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRows((await loadRef.current()) || []);
    } catch (err) {
      setError(err?.message || 'Could not load the video history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchRows();
  }, [open, fetchRows, refreshSignal]);

  return (
    <section className="rounded-xl bg-white border border-[#D8D3C5]" data-testid="video-activity">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex items-center gap-2 text-sm font-bold text-[#22355E] text-left">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />} {title}
        </button>
        {open && (
          <button type="button" onClick={fetchRows} disabled={loading} className="p-1.5 rounded-lg text-[#6E6A64] hover:bg-[#EDEAE0]" aria-label="Refresh history">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>
      {open && (
        <div className="border-t border-[#EDEAE0] px-4 py-3">
          {error && (
            <p role="alert" className="text-xs text-[#9A2820]">
              {error}
            </p>
          )}
          {!error && rows && rows.length === 0 && <p className="text-xs text-[#6E6A64]">{emptyText}</p>}
          {!error && rows && rows.length > 0 && (
            <ul className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {rows.map((e) => {
                const { Icon, cls } = LEVEL[e.level] || LEVEL.info;
                const what = [ACTION_TEXT[e.action] || e.action, e.video?.provider === 'upload' && e.video?.ref ? `“${e.video.ref}”` : ''].filter(Boolean).join(' ');
                return (
                  <li key={e.id} className={`flex gap-2 items-start rounded-lg px-2.5 py-1.5 text-[11px] ${cls}`}>
                    <Icon className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="font-semibold">
                        {showCourse ? `${e.courseSlug.toUpperCase()} · ` : ''}
                        {labelFor ? labelFor(e) : e.targetId}
                      </span>
                      {' - '}
                      {e.actor?.name ? `${e.actor.name} (${e.actor.portal}) ` : e.actor?.portal === 'system' ? 'System: ' : ''}
                      {what}
                      {e.message && e.level !== 'info' ? `. ${e.message}` : ''}
                      <span className="block text-[#6E6A64]">{formatWhen(e.at)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
