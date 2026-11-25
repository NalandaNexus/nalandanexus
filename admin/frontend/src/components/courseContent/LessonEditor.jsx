import React, { useState } from 'react';
import { Save, X, AlertTriangle, Trash2, Eye, EyeOff, Lock, Film } from 'lucide-react';

/**
 * Adding or editing one lesson - title, duration, summary, content, and
 * whether students can see it at all.
 *
 * `lesson` is null when adding a new one. `api` is { save(payload),
 * remove(payload) } (remove is omitted by the caller when adding), bound to
 * the right module. Every save on an existing lesson names the version it
 * loaded (expectedUpdatedAt); a conflicting edit elsewhere is a 409
 * LESSON_CHANGED with the current version attached, never a silent
 * overwrite. Removing is refused (409 LESSON_HAS_PROGRESS) once any student
 * has real progress against the lesson - unpublishing is the way to hide it
 * from students while keeping their history intact, and that refusal says so
 * rather than leaving it unexplained.
 */
export default function LessonEditor({ lesson, api, onSaved, onRemoved, onConflict, onClose }) {
  const isNew = !lesson;
  const [title, setTitle] = useState(lesson?.title || '');
  const [duration, setDuration] = useState(lesson?.duration || '');
  const [summary, setSummary] = useState(lesson?.summary || '');
  const [content, setContent] = useState(lesson?.content || '');
  const [isPublished, setIsPublished] = useState(lesson ? lesson.isPublished !== false : true);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(null);
  const [progressNotice, setProgressNotice] = useState(null);

  const dirty =
    isNew ||
    title.trim() !== (lesson.title || '') ||
    duration.trim() !== (lesson.duration || '') ||
    summary.trim() !== (lesson.summary || '') ||
    content.trim() !== (lesson.content || '') ||
    isPublished !== (lesson.isPublished !== false);
  const valid = title.trim().length > 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || busy) return;
    setError('');
    setConflict(null);
    setBusy(true);
    try {
      const result = await api.save({
        title: title.trim(),
        duration: duration.trim(),
        summary: summary.trim(),
        content: content.trim(),
        isPublished,
        ...(isNew ? {} : { expectedUpdatedAt: lesson.updatedAt }),
      });
      onSaved?.(result);
    } catch (err) {
      if (err?.status === 409 || err?.code === 'LESSON_CHANGED') {
        const current = err?.errors?.current ?? err?.details?.current ?? null;
        setConflict({ message: err.message || 'This lesson was changed by someone else since you opened it.', current });
      } else {
        setError(err?.message || 'Could not save this lesson.');
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setError('');
    setConflict(null);
    setProgressNotice(null);
    setBusy(true);
    try {
      await api.remove({ expectedUpdatedAt: lesson.updatedAt });
      onRemoved?.();
      return;
    } catch (err) {
      if (err?.code === 'LESSON_HAS_PROGRESS') {
        const count = err?.errors?.progressCount ?? err?.details?.progressCount;
        setProgressNotice(
          `${count ?? 'Some'} student${count === 1 ? ' has' : 's have'} already opened or completed this lesson, so it can't be removed. ` +
            'Turn off "Published" instead to hide it from students while keeping their history intact.'
        );
      } else if (err?.status === 409 || err?.code === 'LESSON_CHANGED') {
        const current = err?.errors?.current ?? err?.details?.current ?? null;
        setConflict({ message: err.message || 'This lesson was changed by someone else since you opened it.', current });
      } else {
        setError(err?.message || 'Could not remove this lesson.');
      }
    }
    setBusy(false);
    setConfirmRemove(false);
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-[#D8D3C5] bg-[#FAF9F4] p-4 space-y-3" data-testid="lesson-editor">
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#AB5236]">{isNew ? 'New lesson' : 'Edit lesson'}</h4>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-[#6E6A64] hover:bg-[#EDEAE0] hover:text-[#22355E]"
          aria-label="Close lesson editor"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {!isNew && (lesson.isLocked || lesson.hasVideo) && (
        <div className="flex flex-wrap gap-1.5">
          {lesson.isLocked && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#9B9690]/15 text-[#6E6A64] inline-flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" /> Manually locked
            </span>
          )}
          {lesson.hasVideo && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#22355E]/10 text-[#22355E] inline-flex items-center gap-1">
              <Film className="w-2.5 h-2.5" /> Has a video — manage it from Lesson Videos
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label htmlFor="lesson-title" className="block text-xs font-semibold text-[#22355E] mb-1">
            Title
          </label>
          <input
            id="lesson-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            autoFocus
            required
            className="w-full bg-white border border-[#D8D3C5] rounded-lg px-3 py-2 text-sm text-[#2B2B28] focus:outline-none focus:ring-2 focus:ring-[#22355E]/30 focus:border-[#22355E]"
          />
        </div>
        <div>
          <label htmlFor="lesson-duration" className="block text-xs font-semibold text-[#22355E] mb-1">
            Duration <span className="font-normal text-[#9B9690]">(optional)</span>
          </label>
          <input
            id="lesson-duration"
            type="text"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            maxLength={40}
            placeholder="e.g. 12 min"
            className="w-full bg-white border border-[#D8D3C5] rounded-lg px-3 py-2 text-sm text-[#2B2B28] focus:outline-none focus:ring-2 focus:ring-[#22355E]/30 focus:border-[#22355E]"
          />
        </div>
      </div>

      <div>
        <label htmlFor="lesson-summary" className="block text-xs font-semibold text-[#22355E] mb-1">
          Summary <span className="font-normal text-[#9B9690]">(optional)</span>
        </label>
        <textarea
          id="lesson-summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          maxLength={500}
          rows={2}
          className="w-full bg-white border border-[#D8D3C5] rounded-lg px-3 py-2 text-sm text-[#2B2B28] focus:outline-none focus:ring-2 focus:ring-[#22355E]/30 focus:border-[#22355E] resize-y"
        />
      </div>

      <div>
        <label htmlFor="lesson-content" className="block text-xs font-semibold text-[#22355E] mb-1">
          Content <span className="font-normal text-[#9B9690]">(optional — the lesson's reading material)</span>
        </label>
        <textarea
          id="lesson-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={20000}
          rows={8}
          className="w-full bg-white border border-[#D8D3C5] rounded-lg px-3 py-2 text-sm text-[#2B2B28] font-mono focus:outline-none focus:ring-2 focus:ring-[#22355E]/30 focus:border-[#22355E] resize-y"
        />
      </div>

      <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#22355E] cursor-pointer">
        <input
          type="checkbox"
          checked={isPublished}
          onChange={(e) => setIsPublished(e.target.checked)}
          className="rounded border-[#D8D3C5]"
        />
        {isPublished ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        {isPublished ? 'Published — students can see this lesson' : 'Hidden from students'}
      </label>

      {progressNotice && (
        <div role="alert" className="p-3 rounded-lg bg-[#C99A2E]/10 border border-[#C99A2E]/40 text-[#7A5B12] text-xs">
          {progressNotice}
        </div>
      )}

      {conflict && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-[#C99A2E]/10 border border-[#C99A2E]/40 text-[#7A5B12] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
        >
          <span>{conflict.message} Nothing you typed has been saved.</span>
          <button
            type="button"
            onClick={() => onConflict?.(conflict.current)}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-[#22355E] hover:bg-[#16233F] text-white font-semibold"
          >
            Load the current version
          </button>
        </div>
      )}

      {error && (
        <div role="alert" className="p-3 rounded-lg bg-[#C1352B]/10 border border-[#C1352B]/30 text-[#9A2820] text-xs flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" /> {error}
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#D8D3C5]">
        <div>
          {!isNew &&
            (confirmRemove ? (
              <span className="inline-flex items-center gap-1.5 text-xs">
                <span className="text-[#9A2820] font-semibold">Remove this lesson?</span>
                <button
                  type="button"
                  onClick={remove}
                  disabled={busy}
                  className="px-2.5 py-1.5 rounded-lg bg-[#C1352B] hover:bg-[#A42C23] text-white font-semibold disabled:opacity-60"
                >
                  {busy ? 'Removing…' : 'Yes, remove'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRemove(false)}
                  disabled={busy}
                  className="px-2.5 py-1.5 rounded-lg bg-[#EDEAE0] hover:bg-[#DFDACB] text-[#22355E] font-semibold"
                >
                  Keep
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmRemove(true)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-[#C1352B] hover:bg-[#C1352B]/10 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove lesson
              </button>
            ))}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-3 py-2 rounded-lg text-xs font-semibold text-[#6E6A64] hover:bg-[#EDEAE0] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !valid || !dirty}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-[#AB5236] hover:bg-[#94452C] text-white shadow-sm disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" /> {busy ? 'Saving…' : isNew ? 'Add lesson' : 'Save'}
          </button>
        </div>
      </div>
    </form>
  );
}
