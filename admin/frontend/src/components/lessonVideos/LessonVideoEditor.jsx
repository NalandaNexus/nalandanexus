import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Save,
  Send,
  EyeOff,
  Eye,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Loader2,
  Upload,
  Youtube,
  HardDrive,
  RotateCcw,
  Pencil,
  FileVideo,
} from 'lucide-react';
import VideoPreview from './VideoPreview';
import { parseYoutubeUrl } from '../../utils/youtube';
import { parseGoogleDriveUrl } from '../../utils/googleDrive';
import { uploadVideoFile, readSavedUpload, clearSavedUpload, fileFingerprint, readVideoDuration } from './multipartUpload';
import { VIDEO_SOURCES, formatBytes, formatDuration, formatWhen, isAbort, detailsOf, byline } from './videoFormat';

/**
 * Managing the one primary video of a module (or a lesson).
 *
 * Three sources, each fully handled here:
 *  - Upload a file (MP4, MOV, WEBM, MKV) straight to private storage in parts,
 *    with progress, resume after failure, and server-side verification before
 *    students can see it (multipartUpload.js).
 *  - A YouTube link (watch, youtu.be, shorts, live, embed), parsed as it is
 *    typed with the same module the student service enforces, then checked
 *    with YouTube.
 *  - A Google Drive link, parsed the same way, checked for public sharing, and
 *    explained when students may not be able to open it.
 *
 * Whatever is on the module keeps playing for students until a replacement is
 * saved and (for a file) verified. Every save, visibility change and removal
 * names the version this editor opened with; if someone else changed the video
 * meanwhile, the server refuses (409) and this offers the current version
 * instead of overwriting it.
 *
 * `api` is bound to one module/lesson by the manager: { inspect, save, update,
 * remove, startUpload, partUrls, resume, complete, abortUpload }. Which courses
 * reach this, and whether a change is allowed, is decided by the backend
 * behind it - the Admin portal any course, a teacher only their assigned ones.
 *
 * Shared verbatim by the Admin and Teacher portals: the files in
 * components/lessonVideos/ and utils/{youtube,googleDrive}.js are identical
 * copies (admin/frontend/src/components/lessonVideos/sharedCopies.test.js).
 */

const TONE_STYLE = {
  ok: 'bg-[#5C7A5E]/10 border-[#5C7A5E]/30 text-[#3F5A41]',
  warn: 'bg-[#C99A2E]/10 border-[#C99A2E]/40 text-[#7A5B12]',
  error: 'bg-[#C1352B]/10 border-[#C1352B]/30 text-[#9A2820]',
  info: 'bg-[#22355E]/5 border-[#22355E]/15 text-[#22355E]',
};
const TONE_ICON = { ok: CheckCircle2, warn: AlertTriangle, error: XCircle, info: Info };

const YOUTUBE_STATUS = {
  available: { tone: 'ok', text: 'Valid YouTube video · embedding allowed' },
  restricted: {
    tone: 'warn',
    text: 'YouTube reports that embedding is disabled for this video (or it is private). Students will be offered “Watch on YouTube” instead of the in-page player.',
  },
  unavailable: { tone: 'error', text: 'YouTube cannot find a public video with this id. You can keep it as a draft, but it cannot be published.' },
  unknown: { tone: 'info', text: 'Link is valid. YouTube could not be reached to confirm the video, so it was not checked.' },
};
const DRIVE_STATUS = {
  available: { tone: 'ok', text: 'Valid Google Drive file · shared so that anyone with the link can watch.' },
  restricted: {
    tone: 'warn',
    text: 'This file is not shared publicly. Only students whose Google accounts it is shared with can watch it. To let every enrolled student watch, open the file in Drive → Share → General access → “Anyone with the link” (Viewer).',
  },
  unavailable: { tone: 'error', text: 'Google Drive cannot find this file (deleted, or the link is wrong). It cannot be published.' },
  unknown: { tone: 'info', text: 'Link is valid. Google Drive could not be reached to check how it is shared.' },
};
const DRIVE_SHARING_NOTE =
  'Students open Drive videos with their own Google account. Unless the file is shared with each of them, set its General access to “Anyone with the link” (Viewer), otherwise they will see “You need access”.';

const ACCEPT = '.mp4,.mov,.webm,.mkv,video/mp4,video/quicktime,video/webm,video/x-matroska';
const EXTENSIONS = ['.mp4', '.mov', '.webm', '.mkv'];
const FILE_TYPES = ['', 'video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska', 'video/matroska', 'video/mkv', 'application/octet-stream', 'video/x-m4v'];

const inputCls =
  'w-full bg-white border border-[#D8D3C5] rounded-lg px-3 py-2 text-sm text-[#2B2B28] focus:outline-none focus:ring-2 focus:ring-[#22355E]/30 focus:border-[#22355E]';
const btnSecondary =
  'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#EDEAE0] hover:bg-[#DFDACB] text-[#22355E] disabled:opacity-50';
const btnPrimary =
  'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-[#AB5236] hover:bg-[#94452C] text-white shadow-sm disabled:opacity-50';

function StatusLine({ status, id, testId = 'video-status' }) {
  if (!status) return null;
  const Icon = status.spinning ? Loader2 : TONE_ICON[status.tone];
  return (
    <div id={id} role="status" aria-live="polite" data-testid={testId} className={`mt-2 flex gap-2 items-start text-[11px] leading-snug border rounded-lg px-2.5 py-2 ${TONE_STYLE[status.tone]}`}>
      <Icon className={`w-3.5 h-3.5 shrink-0 mt-px ${status.spinning ? 'animate-spin' : ''}`} aria-hidden="true" />
      <span>{status.text}</span>
    </div>
  );
}

function SourceBadge({ provider }) {
  const Icon = provider === 'youtube' ? Youtube : provider === 'google_drive' ? HardDrive : FileVideo;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#22355E]/10 text-[#22355E]">
      <Icon className="w-3 h-3" aria-hidden="true" /> {VIDEO_SOURCES[provider]?.label || provider}
    </span>
  );
}

export default function LessonVideoEditor({
  lesson,
  api,
  uploadScope,
  uploadsEnabled = true,
  maxUploadBytes,
  onSaved,
  onRemoved,
  onClose,
  onConflict,
  onBusyChange,
}) {
  const saved = lesson.video || null;
  const isModule = lesson.kind === 'module';
  const where = isModule ? 'module' : 'lesson';
  const fieldKey = `${isModule ? 'm' : 'l'}-${lesson.lessonId}`;

  // The version this editor opened with. It does not follow live updates on
  // purpose: a save must be refused if someone else changed the video since.
  const baseRef = useRef(saved?.updatedAt || null);
  const [, setRebased] = useState(0);
  const changedElsewhere = (saved?.updatedAt || null) !== baseRef.current;

  const [tab, setTab] = useState(saved?.provider || (uploadsEnabled ? 'upload' : 'youtube'));
  const [busy, setBusy] = useState(null);
  const [uploadActive, setUploadActive] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(null);

  useEffect(() => {
    onBusyChange?.(uploadActive);
  }, [uploadActive, onBusyChange]);

  const base = () => baseRef.current;
  const rebase = () => {
    baseRef.current = saved?.updatedAt || null;
    setConflict(null);
    setRebased((n) => n + 1);
  };

  const handleFailure = (err, fallback) => {
    if (err?.status === 409 || err?.code === 'VIDEO_CHANGED') {
      const current = detailsOf(err)?.current ?? null;
      setConflict({ message: err.message || 'This video was changed by someone else since you opened it.', current });
      return;
    }
    setError(err?.message || fallback);
  };

  const run = async (name, fn, fallback) => {
    setError('');
    setConflict(null);
    setBusy(name);
    try {
      return await fn();
    } catch (err) {
      handleFailure(err, fallback);
      return null;
    } finally {
      setBusy(null);
    }
  };

  const toggleVisibility = async () => {
    const next = !saved.isPublished;
    const result = await run(next ? 'publish' : 'unpublish', () => api.update({ isPublished: next, expectedUpdatedAt: base() }), 'Could not change who can see this video.');
    if (result) onSaved?.(result.video || null, next ? 'publish' : 'unpublish');
  };

  const remove = async () => {
    const result = await run('remove', () => api.remove({ expectedUpdatedAt: base() }), 'Could not remove this video.');
    setConfirmRemove(false);
    if (result) onRemoved?.();
  };

  const close = () => {
    if (uploadActive && !window.confirm('An upload is in progress. Close and cancel it?')) return;
    onClose?.();
  };

  const anyBusy = Boolean(busy) || uploadActive;
  const tabs = [
    { id: 'upload', label: 'Upload video', Icon: Upload },
    { id: 'youtube', label: 'YouTube link', Icon: Youtube },
    { id: 'google_drive', label: 'Google Drive link', Icon: HardDrive },
  ];

  return (
    <div className="rounded-2xl border border-[#D8D3C5] bg-[#FAF9F4] p-4 sm:p-5 space-y-4" data-testid="lesson-video-editor">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#AB5236]">{isModule ? 'Module video' : 'Lesson video'}</p>
          <h3 className="text-sm font-bold text-[#22355E] truncate">{lesson.title}</h3>
          <p className="text-[11px] text-[#6E6A64]">One primary video at a time. Students keep the current one until a replacement is ready.</p>
        </div>
        <button type="button" onClick={close} className="p-1.5 rounded-lg text-[#6E6A64] hover:bg-[#EDEAE0] hover:text-[#22355E]" aria-label="Close video editor">
          <X className="w-4 h-4" />
        </button>
      </div>

      {changedElsewhere && !conflict && (
        <div role="alert" className="p-3 rounded-lg bg-[#C99A2E]/10 border border-[#C99A2E]/40 text-[#7A5B12] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span>
            {saved ? `This ${where}'s video was just changed${byline(saved) ? ` by ${byline(saved)}` : ''}.` : `This ${where}'s video was just removed by someone else.`} Saving now
            would be refused until you continue from the latest version.
          </span>
          <button type="button" onClick={rebase} disabled={uploadActive} className="shrink-0 px-3 py-1.5 rounded-lg bg-[#22355E] hover:bg-[#16233F] text-white font-semibold disabled:opacity-50">
            Continue from the latest version
          </button>
        </div>
      )}

      {lesson.activeUpload && !uploadActive && (
        <p className="text-[11px] text-[#22355E] bg-[#22355E]/5 border border-[#22355E]/15 rounded-lg px-3 py-2 flex items-center gap-2" data-testid="active-upload-notice">
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden="true" />
          {lesson.activeUpload.status === 'verified'
            ? `An uploaded file (${lesson.activeUpload.fileName}) is verified and waiting for ${lesson.activeUpload.actor?.name || 'its uploader'} to attach it.`
            : `${lesson.activeUpload.actor?.name || 'Someone'} is uploading ${lesson.activeUpload.fileName} (${formatBytes(lesson.activeUpload.fileSize)}). It will replace the current video only once verified.`}
        </p>
      )}

      {lesson.legacyVideoUrl && !saved && (
        <p className="text-[11px] text-[#6E6A64] bg-[#EDEAE0] rounded-lg px-3 py-2">
          This lesson currently plays a directly-hosted file (<span className="font-mono">{lesson.legacyVideoUrl}</span>). A published video replaces it for
          students; removing the video clears both.
        </p>
      )}

      {saved && (
        <section className="rounded-xl border border-[#D8D3C5] bg-white p-3 sm:p-4 space-y-3" aria-label="Current video" data-testid="current-video">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <VideoPreview
                provider={saved.provider}
                videoId={saved.videoId}
                fileId={saved.externalVideoId}
                resourceKey={saved.externalResourceKey}
                streamUrl={saved.streamUrl}
                title={saved.title}
              />
            </div>
            <div className="lg:col-span-3 space-y-2 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <SourceBadge provider={saved.provider} />
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${saved.isPublished ? 'bg-[#5C7A5E]/15 text-[#3F5A41]' : 'bg-[#C99A2E]/15 text-[#7A5B12]'}`}
                  data-testid="current-visibility"
                >
                  {saved.isPublished ? 'Published · students see it' : 'Draft · hidden from students'}
                </span>
                {saved.availability === 'unavailable' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#C1352B]/15 text-[#9A2820]">Unavailable</span>}
                {saved.availability === 'restricted' && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#C99A2E]/15 text-[#7A5B12]">
                    {saved.provider === 'google_drive' ? 'Not shared publicly' : 'Embedding off'}
                  </span>
                )}
              </div>
              {editingDetails ? (
                <DetailsForm
                  saved={saved}
                  fieldKey={fieldKey}
                  busy={busy === 'details'}
                  onCancel={() => setEditingDetails(false)}
                  onSubmit={async ({ title, description }) => {
                    const result = await run('details', () => api.update({ title, description, expectedUpdatedAt: base() }), 'Could not save the details.');
                    if (result) {
                      setEditingDetails(false);
                      onSaved?.(result.video || null, 'details');
                    }
                  }}
                />
              ) : (
                <>
                  <p className="text-sm font-semibold text-[#2B2B28] break-words">{saved.title || <span className="text-[#9B9690]">Untitled</span>}</p>
                  {saved.description && <p className="text-xs text-[#6E6A64] whitespace-pre-line">{saved.description}</p>}
                </>
              )}
              <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5 text-[11px] text-[#6E6A64]">
                {saved.provider === 'upload' && (
                  <>
                    <dt>File</dt>
                    <dd className="text-[#2B2B28] break-all">{saved.fileName}</dd>
                    <dt>Size</dt>
                    <dd className="text-[#2B2B28]">{formatBytes(saved.fileSize)}</dd>
                    {Number.isFinite(saved.duration) && (
                      <>
                        <dt>Duration</dt>
                        <dd className="text-[#2B2B28]">{formatDuration(saved.duration)}</dd>
                      </>
                    )}
                    <dt>Uploaded</dt>
                    <dd className="text-[#2B2B28]">{formatWhen(saved.uploadedAt)}</dd>
                    <dt>Status</dt>
                    <dd className="text-[#3F5A41] font-semibold">Upload complete · file verified</dd>
                  </>
                )}
                {saved.provider !== 'upload' && saved.originalUrl && (
                  <>
                    <dt>Link</dt>
                    <dd className="text-[#2B2B28] break-all font-mono">{saved.originalUrl}</dd>
                  </>
                )}
                <dt>Last change</dt>
                <dd className="text-[#2B2B28]">
                  {formatWhen(saved.updatedAt)}
                  {byline(saved) && ` by ${byline(saved)}`}
                </dd>
              </dl>
              {saved.provider === 'google_drive' && <p className="text-[11px] text-[#7A5B12]">{DRIVE_SHARING_NOTE}</p>}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {!editingDetails && (
                  <button type="button" onClick={() => setEditingDetails(true)} disabled={anyBusy || changedElsewhere} className={btnSecondary}>
                    <Pencil className="w-3.5 h-3.5" /> Edit title
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleVisibility}
                  disabled={anyBusy || changedElsewhere || (!saved.isPublished && saved.availability === 'unavailable')}
                  className={btnSecondary}
                >
                  {saved.isPublished ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {busy === 'publish' ? 'Publishing…' : busy === 'unpublish' ? 'Unpublishing…' : saved.isPublished ? 'Unpublish' : 'Publish'}
                </button>
                {confirmRemove ? (
                  <span className="inline-flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-[#9A2820] font-semibold">Remove this video from the {where}? Students stop seeing it at once.</span>
                    <button
                      type="button"
                      onClick={remove}
                      disabled={anyBusy}
                      className="px-2.5 py-1.5 rounded-lg bg-[#C1352B] hover:bg-[#A42C23] text-white font-semibold disabled:opacity-60"
                    >
                      {busy === 'remove' ? 'Removing…' : 'Yes, remove'}
                    </button>
                    <button type="button" onClick={() => setConfirmRemove(false)} disabled={anyBusy} className={btnSecondary}>
                      Keep
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(true)}
                    disabled={anyBusy || changedElsewhere}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-[#C1352B] hover:bg-[#C1352B]/10 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove video
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {!saved && lesson.legacyVideoUrl && (
        <div className="flex justify-end">
          {confirmRemove ? (
            <span className="inline-flex items-center gap-1.5 text-xs">
              <span className="text-[#9A2820] font-semibold">Clear the hosted file?</span>
              <button type="button" onClick={remove} disabled={anyBusy} className="px-2.5 py-1.5 rounded-lg bg-[#C1352B] text-white font-semibold">
                {busy === 'remove' ? 'Removing…' : 'Yes, remove'}
              </button>
              <button type="button" onClick={() => setConfirmRemove(false)} className={btnSecondary}>
                Keep
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmRemove(true)} disabled={anyBusy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-[#C1352B] hover:bg-[#C1352B]/10">
              <Trash2 className="w-3.5 h-3.5" /> Remove hosted file
            </button>
          )}
        </div>
      )}

      <section className="space-y-3" aria-label={saved ? 'Replace the video' : 'Add a video'}>
        <h4 className="text-xs font-bold text-[#22355E]">{saved ? 'Replace with a different video' : `Add a video to this ${where}`}</h4>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Video source">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              disabled={uploadActive && tab !== id}
              onClick={() => {
                setTab(id);
                setError('');
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
                tab === id ? 'bg-[#22355E] text-white' : 'bg-white border border-[#D8D3C5] text-[#22355E] hover:bg-[#EDEAE0]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden="true" /> {label}
            </button>
          ))}
        </div>

        {tab === 'upload' ? (
          <UploadForm
            key="upload"
            fieldKey={fieldKey}
            api={api}
            saved={saved}
            base={base}
            scope={uploadScope || fieldKey}
            uploadsEnabled={uploadsEnabled}
            maxUploadBytes={maxUploadBytes}
            disabled={changedElsewhere || Boolean(busy)}
            onActiveChange={setUploadActive}
            onSaved={onSaved}
            onConflict={onConflict}
          />
        ) : (
          <LinkForm
            key={tab}
            provider={tab}
            fieldKey={fieldKey}
            api={api}
            saved={saved}
            busy={busy}
            disabled={changedElsewhere}
            onSubmit={async (payload, mode) => {
              const result = await run(mode, () => api.save({ ...payload, expectedUpdatedAt: base() }), 'Could not save this video.');
              if (result) onSaved?.(result.video || null, mode);
            }}
          />
        )}
      </section>

      {conflict && (
        <div role="alert" className="p-3 rounded-lg bg-[#C99A2E]/10 border border-[#C99A2E]/40 text-[#7A5B12] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span>{conflict.message} Nothing you changed here has been saved.</span>
          <button type="button" onClick={() => onConflict?.(conflict.current)} className="shrink-0 px-3 py-1.5 rounded-lg bg-[#22355E] hover:bg-[#16233F] text-white font-semibold">
            Load the current version
          </button>
        </div>
      )}
      {error && (
        <div role="alert" className="p-3 rounded-lg bg-[#C1352B]/10 border border-[#C1352B]/30 text-[#9A2820] text-xs">
          {error}
        </div>
      )}
    </div>
  );
}

function DetailsForm({ saved, fieldKey, busy, onCancel, onSubmit }) {
  const [title, setTitle] = useState(saved.title || '');
  const [description, setDescription] = useState(saved.description || '');
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ title: title.trim(), description: description.trim() });
      }}
    >
      <label htmlFor={`vid-details-title-${fieldKey}`} className="block text-xs font-semibold text-[#22355E]">
        Title
      </label>
      <input id={`vid-details-title-${fieldKey}`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className={inputCls} />
      <label htmlFor={`vid-details-desc-${fieldKey}`} className="block text-xs font-semibold text-[#22355E]">
        Description
      </label>
      <textarea id={`vid-details-desc-${fieldKey}`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={2} className={inputCls} />
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={btnPrimary}>
          <Save className="w-3.5 h-3.5" /> {busy ? 'Saving…' : 'Save details'}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className={btnSecondary}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// --- YouTube and Google Drive links ---------------------------------------------------------------

function LinkForm({ provider, fieldKey, api, saved, busy, disabled, onSubmit }) {
  const isYoutube = provider === 'youtube';
  const sameSource = saved?.provider === provider ? saved : null;
  const [url, setUrl] = useState(sameSource?.originalUrl || '');
  const [title, setTitle] = useState(sameSource?.title || '');
  const [titleTouched, setTitleTouched] = useState(Boolean(sameSource?.title));
  const [description, setDescription] = useState(sameSource?.description || '');
  const [playbackMode, setPlaybackMode] = useState(sameSource?.playbackMode || 'embed');
  const [check, setCheck] = useState({ state: 'idle', data: null });
  const [thumbMissing, setThumbMissing] = useState(false);
  const inputRef = useRef(null);

  const parsed = useMemo(() => (isYoutube ? parseYoutubeUrl(url) : parseGoogleDriveUrl(url)), [url, isYoutube]);
  const id = parsed.ok ? (isYoutube ? parsed.videoId : parsed.fileId) : null;
  const savedId = sameSource ? (isYoutube ? sameSource.videoId : sameSource.externalVideoId) : null;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setThumbMissing(false);
    if (!id) {
      setCheck({ state: 'idle', data: null });
      return undefined;
    }
    if (id === savedId) {
      setCheck({ state: 'done', data: { availability: sameSource.availability } });
      return undefined;
    }
    const controller = new AbortController();
    setCheck({ state: 'checking', data: null });
    const timer = setTimeout(async () => {
      try {
        const data = await api.inspect(url, { provider, signal: controller.signal });
        if (controller.signal.aborted) return;
        setCheck({ state: 'done', data });
        if (data?.title) setTitle((current) => (titleTouched || current.trim() ? current : data.title));
      } catch (err) {
        if (isAbort(err) || controller.signal.aborted) return;
        if (err?.status >= 400 && err?.status < 500) setCheck({ state: 'error', data: null, message: err.message });
        else setCheck({ state: 'done', data: { availability: 'unknown' } });
      }
    }, 500);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const availability = check.state === 'done' ? check.data?.availability || 'unknown' : null;
  const unavailable = availability === 'unavailable' || (isYoutube && thumbMissing && availability !== 'available');
  const table = isYoutube ? YOUTUBE_STATUS : DRIVE_STATUS;

  let status;
  if (!url.trim()) {
    status = isYoutube
      ? { tone: 'info', text: 'Paste a YouTube link - watch, youtu.be, Shorts, live and embed links all work.' }
      : { tone: 'info', text: 'Paste the Google Drive link from Share → Copy link.' };
  } else if (!parsed.ok) status = { tone: 'error', text: parsed.message };
  else if (check.state === 'checking') status = { tone: 'info', text: isYoutube ? 'Checking with YouTube…' : 'Checking with Google Drive…', spinning: true };
  else if (check.state === 'error') status = { tone: 'error', text: check.message || 'The link was refused.' };
  else if (unavailable) status = table.unavailable;
  else if (check.data?.notVideo) status = { tone: 'warn', text: `This Drive file (“${check.data.title}”) does not look like a video. Check that you shared the right file.` };
  else if (availability) status = table[availability] || table.unknown;
  else status = { tone: 'info', text: 'Link is valid.' };

  const dirty =
    !sameSource ||
    savedId !== id ||
    (sameSource.title || '') !== title.trim() ||
    (sameSource.description || '') !== description.trim() ||
    (isYoutube && (sameSource.playbackMode || 'embed') !== playbackMode);
  const canSubmit = parsed.ok && check.state !== 'checking' && check.state !== 'error' && !disabled && !busy;
  const submit = (mode) =>
    onSubmit(
      {
        provider,
        url: url.trim(),
        title: title.trim(),
        description: description.trim(),
        ...(isYoutube ? { playbackMode } : {}),
        isPublished: mode === 'publish',
      },
      mode
    );

  const label = isYoutube ? 'YouTube video URL' : 'Google Drive sharing link';
  return (
    <div className="space-y-3" data-testid={`link-form-${provider}`}>
      {!isYoutube && (
        <p className="text-[11px] text-[#22355E] bg-[#22355E]/5 border border-[#22355E]/15 rounded-lg px-3 py-2 flex gap-2">
          <Info className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
          {DRIVE_SHARING_NOTE}
        </p>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2">
          <VideoPreview
            provider={id ? provider : null}
            videoId={isYoutube ? id : null}
            fileId={!isYoutube ? id : null}
            resourceKey={!isYoutube && parsed.ok ? parsed.resourceKey : null}
            title={title}
            onThumbStatus={(s) => setThumbMissing(s === 'missing')}
          />
        </div>
        <div className="lg:col-span-3 space-y-3">
          <div>
            <label htmlFor={`vid-url-${provider}-${fieldKey}`} className="block text-xs font-semibold text-[#22355E] mb-1">
              {label}
            </label>
            <input
              id={`vid-url-${provider}-${fieldKey}`}
              ref={inputRef}
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={isYoutube ? 'https://www.youtube.com/watch?v=…' : 'https://drive.google.com/file/d/…/view'}
              maxLength={2048}
              aria-invalid={Boolean(url.trim()) && !parsed.ok}
              aria-describedby={`vid-status-${provider}-${fieldKey}`}
              className={inputCls}
            />
            <StatusLine status={status} id={`vid-status-${provider}-${fieldKey}`} />
          </div>
          <div>
            <label htmlFor={`vid-title-${provider}-${fieldKey}`} className="block text-xs font-semibold text-[#22355E] mb-1">
              Video title
            </label>
            <input
              id={`vid-title-${provider}-${fieldKey}`}
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setTitleTouched(true);
              }}
              maxLength={200}
              placeholder={isYoutube ? 'Filled in from YouTube when left blank' : 'Filled in from the Drive file name when left blank'}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor={`vid-desc-${provider}-${fieldKey}`} className="block text-xs font-semibold text-[#22355E] mb-1">
              Description <span className="font-normal text-[#9B9690]">(optional)</span>
            </label>
            <textarea
              id={`vid-desc-${provider}-${fieldKey}`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={2}
              className={`${inputCls} resize-y`}
            />
          </div>
          {isYoutube && (
            <fieldset>
              <legend className="block text-xs font-semibold text-[#22355E] mb-1">Playback</legend>
              <div className="inline-flex rounded-lg border border-[#D8D3C5] bg-white p-0.5 text-xs font-semibold">
                {[
                  ['embed', 'Play inside Nalanda'],
                  ['external', 'Open on YouTube'],
                ].map(([value, text]) => (
                  <label key={value} className={`px-3 py-1.5 rounded-md cursor-pointer ${playbackMode === value ? 'bg-[#22355E] text-white' : 'text-[#6E6A64] hover:text-[#22355E]'}`}>
                    <input type="radio" name={`vid-mode-${fieldKey}`} value={value} checked={playbackMode === value} onChange={() => setPlaybackMode(value)} className="sr-only" />
                    {text}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button type="button" onClick={() => submit('draft')} disabled={!canSubmit || (!dirty && !sameSource?.isPublished)} className={btnSecondary}>
              <Save className="w-3.5 h-3.5" /> {busy === 'draft' ? 'Saving…' : 'Save as draft'}
            </button>
            <button
              type="button"
              onClick={() => submit('publish')}
              disabled={!canSubmit || unavailable || (!dirty && sameSource?.isPublished)}
              title={unavailable ? 'This video cannot be published' : undefined}
              className={btnPrimary}
            >
              <Send className="w-3.5 h-3.5" />
              {busy === 'publish' ? 'Publishing…' : saved ? 'Replace and publish' : 'Publish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Uploaded files --------------------------------------------------------------------------------

const PHASE_TEXT = {
  starting: 'Preparing the upload…',
  resuming: 'Checking which parts already reached storage…',
  uploading: 'Uploading',
  processing: 'Processing - assembling and verifying the file. Students will see it only once this finishes.',
  completed: 'Completed - the video is attached.',
  failed: 'Upload failed',
};

function validateFile(file, maxUploadBytes) {
  const name = file.name || '';
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')).toLowerCase() : '';
  if (!EXTENSIONS.includes(ext)) return 'Choose an MP4, MOV, WEBM or MKV video file.';
  if (!FILE_TYPES.includes((file.type || '').toLowerCase())) return `This file is “${file.type}”, not a video. Choose an MP4, MOV, WEBM or MKV video file.`;
  if (!file.size) return 'This file is empty.';
  if (maxUploadBytes && file.size > maxUploadBytes) return `This file is ${formatBytes(file.size)}; the upload limit is ${formatBytes(maxUploadBytes)}.`;
  return '';
}

function UploadForm({ fieldKey, api, saved, base, scope, uploadsEnabled, maxUploadBytes, disabled, onActiveChange, onSaved, onConflict }) {
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [duration, setDuration] = useState(undefined);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [publish, setPublish] = useState(true);
  const [phase, setPhase] = useState('idle');
  const [progress, setProgress] = useState({ loaded: 0, total: 0, fraction: 0 });
  const [rate, setRate] = useState(null);
  const [error, setError] = useState(null);
  const [conflict, setConflict] = useState(null);
  const [dragging, setDragging] = useState(false);
  const controllerRef = useRef(null);
  const uploadIdRef = useRef(null);
  const samples = useRef([]);
  const mounted = useRef(true);

  const active = ['starting', 'resuming', 'uploading', 'processing'].includes(phase);
  useEffect(() => {
    onActiveChange?.(active);
  }, [active, onActiveChange]);

  // Set on every mount, not only the first: React's development double-mount
  // runs the cleanup once, and a flag left false would drop every update.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  // Leaving the page mid-upload loses nothing that cannot be resumed, but say so.
  useEffect(() => {
    if (!active) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [active]);

  const resumable = useMemo(() => {
    if (!file) return null;
    const savedSession = readSavedUpload(scope);
    return savedSession?.fingerprint === fileFingerprint(file) ? savedSession : null;
  }, [file, scope, phase]);

  const choose = async (picked) => {
    if (!picked) return;
    setError(null);
    setConflict(null);
    setPhase('idle');
    const problem = validateFile(picked, maxUploadBytes);
    setFileError(problem);
    setFile(problem ? null : picked);
    setDuration(undefined);
    if (!problem) {
      if (!title.trim()) setTitle(picked.name.replace(/\.[^.]+$/, '').slice(0, 200));
      const seconds = await readVideoDuration(picked);
      if (mounted.current) setDuration(seconds);
    }
  };

  const onProgress = (p) => {
    setProgress(p);
    const now = Date.now();
    samples.current = [...samples.current.filter((s) => now - s.t < 8000), { t: now, loaded: p.loaded }];
    const first = samples.current[0];
    if (first && now - first.t > 1000) setRate((p.loaded - first.loaded) / ((now - first.t) / 1000));
  };

  const start = async () => {
    if (!file || active) return;
    setError(null);
    setConflict(null);
    samples.current = [];
    setRate(null);
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const result = await uploadVideoFile({
        file,
        scope,
        duration,
        signal: controller.signal,
        api: {
          start: (payload) => api.startUpload(payload),
          partUrls: (id, numbers) => api.partUrls(id, numbers),
          resume: (id) => api.resume(id),
          complete: (id, body) => api.complete(id, body),
        },
        startPayload: {
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || '',
          title: title.trim(),
          description: description.trim(),
          isPublished: publish,
          expectedUpdatedAt: base(),
        },
        onPhase: (p) => mounted.current && setPhase(p),
        onProgress: (p) => mounted.current && onProgress(p),
        onSession: ({ uploadId }) => {
          uploadIdRef.current = uploadId;
        },
      });
      if (!mounted.current) return;
      setPhase('completed');
      onSaved?.(result.video || null, result.video?.isPublished ? 'publish' : 'draft');
    } catch (err) {
      if (!mounted.current) return;
      if (isAbort(err)) {
        setPhase('idle');
        return;
      }
      if (err?.status === 409 || err?.code === 'VIDEO_CHANGED') {
        setPhase('conflict');
        setConflict({ message: err.message, current: detailsOf(err)?.current ?? null, uploadId: detailsOf(err)?.uploadId || uploadIdRef.current });
        return;
      }
      setPhase('failed');
      setError({ message: err?.message || 'The upload failed.', code: err?.code, retryable: !['VIDEO_VERIFICATION_FAILED', 'VIDEO_SIZE_MISMATCH', 'UNSUPPORTED_VIDEO_TYPE', 'VIDEO_TYPE_MISMATCH', 'VIDEO_TOO_LARGE', 'VIDEO_STORAGE_NOT_CONFIGURED'].includes(err?.code) });
    }
  };

  const cancel = async () => {
    controllerRef.current?.abort();
    const id = uploadIdRef.current || readSavedUpload(scope)?.uploadId;
    clearSavedUpload(scope);
    uploadIdRef.current = null;
    setPhase('idle');
    setProgress({ loaded: 0, total: 0, fraction: 0 });
    if (id) {
      try {
        await api.abortUpload(id);
      } catch {
        // The server's sweep abandons it within a day anyway.
      }
    }
  };

  const useMine = async () => {
    try {
      setPhase('processing');
      const result = await api.complete(conflict.uploadId, { expectedUpdatedAt: conflict.current?.updatedAt ?? null });
      clearSavedUpload(scope);
      setConflict(null);
      setPhase('completed');
      onSaved?.(result.video || null, result.video?.isPublished ? 'publish' : 'draft');
    } catch (err) {
      setPhase('conflict');
      setConflict((c) => ({ ...c, message: err?.message || 'Could not attach your upload.', current: detailsOf(err)?.current ?? c.current }));
    }
  };

  const keepTheirs = async () => {
    const { current, uploadId } = conflict;
    clearSavedUpload(scope);
    setConflict(null);
    setPhase('idle');
    try {
      await api.abortUpload(uploadId);
    } catch {
      // Deleted by the sweep after a day if this fails.
    }
    onConflict?.(current);
  };

  if (!uploadsEnabled) {
    return (
      <p className="text-xs text-[#22355E] bg-[#22355E]/5 border border-[#22355E]/15 rounded-lg px-3 py-3" data-testid="uploads-disabled">
        Uploading files is not available yet: the server's private video storage has not been configured. Use a YouTube or Google Drive link meanwhile.
      </p>
    );
  }

  const pct = Math.floor((progress.fraction || 0) * 100);
  const remaining = rate && rate > 0 ? Math.max(0, (progress.total - progress.loaded) / rate) : null;
  const isMkv = file && /\.mkv$/i.test(file.name);

  return (
    <div className="space-y-3" data-testid="upload-form">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2">
          <VideoPreview provider={file ? 'upload' : null} localFile={file} title={title} />
        </div>
        <div className="lg:col-span-3 space-y-3">
          <label
            htmlFor={`vid-file-${fieldKey}`}
            onDragOver={(e) => {
              e.preventDefault();
              if (!active) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!active) choose(e.dataTransfer.files?.[0]);
            }}
            className={`block rounded-xl border-2 border-dashed px-4 py-5 text-center cursor-pointer transition-colors ${
              dragging ? 'border-[#AB5236] bg-[#AB5236]/5' : 'border-[#D8D3C5] bg-white hover:border-[#22355E]/40'
            } ${active ? 'pointer-events-none opacity-60' : ''}`}
          >
            <Upload className="w-6 h-6 mx-auto text-[#AB5236]" aria-hidden="true" />
            <span className="block text-xs font-semibold text-[#22355E] mt-1">Choose a video file or drop it here</span>
            <span className="block text-[11px] text-[#6E6A64]">
              MP4, MOV, WEBM or MKV{maxUploadBytes ? ` · up to ${formatBytes(maxUploadBytes)}` : ''} · large files upload in resumable parts
            </span>
            <input
              id={`vid-file-${fieldKey}`}
              type="file"
              accept={ACCEPT}
              disabled={active || disabled}
              onChange={(e) => {
                choose(e.target.files?.[0]);
                e.target.value = '';
              }}
              className="sr-only"
              data-testid="video-file-input"
            />
          </label>
          {fileError && (
            <p role="alert" className="text-[11px] text-[#9A2820] bg-[#C1352B]/10 border border-[#C1352B]/30 rounded-lg px-3 py-2">
              {fileError}
            </p>
          )}
          {file && (
            <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5 text-[11px] text-[#6E6A64] bg-white border border-[#D8D3C5] rounded-lg px-3 py-2" data-testid="selected-file">
              <dt>File</dt>
              <dd className="text-[#2B2B28] break-all">{file.name}</dd>
              <dt>Size</dt>
              <dd className="text-[#2B2B28]">{formatBytes(file.size)}</dd>
              <dt>Duration</dt>
              <dd className="text-[#2B2B28]">{duration !== undefined ? formatDuration(duration) : 'read after upload'}</dd>
            </dl>
          )}
          {isMkv && (
            <p className="text-[11px] text-[#7A5B12] bg-[#C99A2E]/10 border border-[#C99A2E]/40 rounded-lg px-3 py-2">
              MKV files play in Chrome, Edge and Firefox but not in Safari or on iPhones and iPads. Upload MP4 (H.264) for every student to be able to watch.
            </p>
          )}
          {file && resumable && phase === 'idle' && (
            <p className="text-[11px] text-[#22355E] bg-[#22355E]/5 border border-[#22355E]/15 rounded-lg px-3 py-2" data-testid="resume-notice">
              An unfinished upload of this file was found. Starting will continue it from where it stopped.
            </p>
          )}
          <div>
            <label htmlFor={`vid-up-title-${fieldKey}`} className="block text-xs font-semibold text-[#22355E] mb-1">
              Video title
            </label>
            <input id={`vid-up-title-${fieldKey}`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} disabled={active} className={inputCls} />
          </div>
          <div>
            <label htmlFor={`vid-up-desc-${fieldKey}`} className="block text-xs font-semibold text-[#22355E] mb-1">
              Description <span className="font-normal text-[#9B9690]">(optional)</span>
            </label>
            <textarea id={`vid-up-desc-${fieldKey}`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={2} disabled={active} className={`${inputCls} resize-y`} />
          </div>
          <label className="flex items-center gap-2 text-xs text-[#22355E]">
            <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} disabled={active} className="accent-[#AB5236]" />
            Publish to students as soon as the file is verified
          </label>

          {phase !== 'idle' && phase !== 'conflict' && (
            <div className="space-y-1.5" data-testid="upload-progress">
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#22355E]">
                <span data-testid="upload-phase">
                  {phase === 'uploading' ? `Uploading ${pct}%` : PHASE_TEXT[phase]}
                </span>
                {phase === 'uploading' && (
                  <span className="text-[#6E6A64] font-normal">
                    {formatBytes(progress.loaded)} of {formatBytes(progress.total)}
                    {rate ? ` · ${formatBytes(rate)}/s` : ''}
                    {remaining !== null && remaining > 1 ? ` · about ${formatDuration(remaining)} left` : ''}
                  </span>
                )}
              </div>
              <div
                className="h-2 rounded-full bg-[#EDEAE0] overflow-hidden"
                role="progressbar"
                aria-label="Upload progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={phase === 'completed' || phase === 'processing' ? 100 : pct}
              >
                <div
                  className={`h-full transition-[width] duration-300 ${phase === 'failed' ? 'bg-[#C1352B]' : phase === 'processing' ? 'bg-[#22355E] animate-pulse' : 'bg-[#AB5236]'}`}
                  style={{ width: `${phase === 'completed' || phase === 'processing' ? 100 : pct}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div role="alert" className="p-3 rounded-lg bg-[#C1352B]/10 border border-[#C1352B]/30 text-[#9A2820] text-xs space-y-2" data-testid="upload-error">
              <p>{error.message}</p>
              {error.retryable && <p className="text-[#6E6A64]">Parts already uploaded are kept; retrying continues from where it stopped.</p>}
            </div>
          )}

          {conflict && (
            <div role="alert" className="p-3 rounded-lg bg-[#C99A2E]/10 border border-[#C99A2E]/40 text-[#7A5B12] text-xs space-y-2" data-testid="upload-conflict">
              <p>
                While you were uploading, someone else changed this video{conflict.current?.updatedBy?.name ? ` (${byline(conflict.current)})` : ''}. Your file is uploaded and
                verified, but it has not replaced theirs.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={useMine} className={btnPrimary}>
                  Replace it with my upload
                </button>
                <button type="button" onClick={keepTheirs} className={btnSecondary}>
                  Keep their video
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            {(active || phase === 'failed') && (
              <button type="button" onClick={cancel} disabled={phase === 'processing'} className={btnSecondary}>
                <X className="w-3.5 h-3.5" /> {phase === 'failed' ? 'Discard upload' : 'Cancel upload'}
              </button>
            )}
            {phase === 'failed' && error?.retryable ? (
              <button type="button" onClick={start} disabled={!file || disabled} className={btnPrimary}>
                <RotateCcw className="w-3.5 h-3.5" /> Retry upload
              </button>
            ) : (
              !active &&
              phase !== 'conflict' && (
                <button type="button" onClick={start} disabled={!file || disabled} className={btnPrimary}>
                  <Upload className="w-3.5 h-3.5" />
                  {resumable ? 'Resume upload' : saved ? 'Upload and replace' : 'Upload video'}
                </button>
              )
            )}
            {active && (
              <span className="inline-flex items-center gap-1.5 text-xs text-[#6E6A64]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> {phase === 'processing' ? 'Verifying…' : 'Uploading…'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
