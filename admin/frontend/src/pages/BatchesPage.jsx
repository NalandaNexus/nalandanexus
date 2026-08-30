import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Layers, Plus, Search, X, Users, AlertTriangle, UserCog, Archive } from 'lucide-react';
import { adminApi } from '../services/adminApi';

/**
 * Batch administration.
 *
 * A course (PRARAMBH) runs several batches (PB1, PB2, PB3), each with its own
 * teacher, capacity and students. Batches live in the Teacher service, so
 * everything here goes through the proxy endpoints - which means the occupancy
 * shown is the same counter capacity is actually enforced against, never a
 * number this page derives from a partial roster.
 *
 * The word "class" appears in the underlying API for historical reasons; users
 * only ever see "batch".
 */

/** FULL is derived from occupancy, never a stored status - a stored flag drifts the moment a seat frees up. */
function occupancyTone(batch) {
  if (batch.status === 'archived') return { label: 'Archived', cls: 'bg-slate-100 text-slate-600 border-slate-200' };
  if (batch.isFull) return { label: 'Full', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { label: 'Active', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
}

function SeatBar({ enrolled, capacity }) {
  const pct = capacity > 0 ? Math.min(100, Math.round((enrolled / capacity) * 100)) : 0;
  const tone = pct >= 100 ? 'bg-amber-500' : pct >= 85 ? 'bg-[#C99A2E]' : 'bg-[#22355E]';
  return (
    <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
      <div className={`h-full ${tone} rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function BatchesPage() {
  const [batches, setBatches] = useState([]);
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [catalogAvailable, setCatalogAvailable] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState({ courseSlug: '', teacherEmail: '', status: 'active', search: '' });

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [reassigning, setReassigning] = useState(null);
  const [roster, setRoster] = useState(null);

  const load = useCallback(async () => {
    try {
      setError('');
      const query = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v !== 'all'));
      const { batches: rows, catalogAvailable: ok } = await adminApi.getBatches(query);
      setBatches(rows);
      setCatalogAvailable(ok);
    } catch (err) {
      setError(err.message || 'Could not load batches.');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    adminApi.getCourses().then(setCourses).catch(() => {});
    adminApi.getTeachers().then((t) => setTeachers(Array.isArray(t) ? t : t?.teachers || [])).catch(() => {});
  }, []);

  const courseOptions = useMemo(
    () => courses.filter((c) => c.slug).map((c) => ({ slug: c.slug, title: c.title, status: c.status })),
    [courses]
  );

  const totals = useMemo(
    () =>
      batches.reduce(
        (acc, b) => ({
          seats: acc.seats + (b.capacity || 0),
          filled: acc.filled + (b.enrolledCount || 0),
        }),
        { seats: 0, filled: 0 }
      ),
    [batches]
  );

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#22355E] flex items-center gap-2">
            <Layers className="w-6 h-6" /> Batch Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Every batch across all faculty. A course runs several batches, each with its own teacher and seats.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 bg-[#22355E] hover:bg-[#16233F] text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> Create Batch
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={load} className="font-semibold underline whitespace-nowrap">Retry</button>
        </div>
      )}

      {!catalogAvailable && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            The course catalogue is unreachable, so course names may be missing below and new batches cannot be verified
            against it. Nothing is broken — try again shortly.
          </span>
        </div>
      )}

      {/* Filters are sent to the server; narrowing a fully-fetched list here
          would quietly lie once there are more batches than one response holds. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-xl bg-white border border-slate-200">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            placeholder="Search batch name or code"
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <select
          value={filters.courseSlug}
          onChange={(e) => setFilters((f) => ({ ...f, courseSlug: e.target.value }))}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
          aria-label="Filter by course"
        >
          <option value="">All courses</option>
          {courseOptions.map((c) => (
            <option key={c.slug} value={c.slug}>{c.title}</option>
          ))}
        </select>
        <select
          value={filters.teacherEmail}
          onChange={(e) => setFilters((f) => ({ ...f, teacherEmail: e.target.value }))}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
          aria-label="Filter by teacher"
        >
          <option value="">All teachers</option>
          {teachers.map((t) => (
            <option key={t._id || t.id} value={t.email}>{t.name}</option>
          ))}
        </select>
        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm"
          aria-label="Filter by status"
        >
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="all">All statuses</option>
        </select>
      </div>

      {!isLoading && batches.length > 0 && (
        <p className="text-xs text-slate-500 font-mono">
          {batches.length} batch{batches.length === 1 ? '' : 'es'} · {totals.filled} of {totals.seats} seats filled
        </p>
      )}

      {isLoading ? (
        <div className="p-10 text-center text-sm text-slate-400 bg-white rounded-xl border border-slate-200">Loading batches…</div>
      ) : batches.length === 0 ? (
        <div className="p-10 text-center bg-white rounded-xl border border-slate-200">
          <p className="text-sm text-slate-500">No batches match these filters.</p>
          <p className="text-xs text-slate-400 mt-1">A batch needs a published course and an active teacher before it can be created.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {batches.map((b) => {
            const tone = occupancyTone(b);
            return (
              <div key={b.id} className="p-5 rounded-xl bg-white border border-slate-200 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-[#22355E] truncate">{b.name}</h3>
                    <p className="text-xs text-slate-500 truncate" title={b.courseTitle || b.courseSlug || ''}>
                      {b.courseTitle || b.courseSlug || <span className="text-amber-700">No course linked</span>}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border flex-shrink-0 ${tone.cls}`}>
                    {tone.label}
                  </span>
                </div>

                <div>
                  <div className="flex items-baseline justify-between text-sm mb-1.5">
                    <span className="font-mono font-bold text-[#22355E] tabular-nums">
                      {b.enrolledCount} / {b.capacity}
                    </span>
                    <span className="text-xs text-slate-500">
                      {b.isFull ? 'No seats left' : `${b.seatsRemaining} seat${b.seatsRemaining === 1 ? '' : 's'} left`}
                    </span>
                  </div>
                  <SeatBar enrolled={b.enrolledCount} capacity={b.capacity} />
                  {b.verifiedStudents !== b.enrolledCount && (
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      {b.verifiedStudents} verified so far — the rest are placed and awaiting the next enrollment sync.
                    </p>
                  )}
                </div>

                <div className="text-xs text-slate-600 border-t border-slate-100 pt-3">
                  <span className="text-slate-400">Teacher</span>
                  <p className="font-semibold text-[#22355E] truncate">{b.teacher?.name || 'Unassigned'}</p>
                  {b.teacher?.email && <p className="text-slate-400 truncate font-mono text-[11px]">{b.teacher.email}</p>}
                </div>

                <div className="flex flex-wrap gap-2 mt-auto pt-1">
                  <button type="button" onClick={() => setRoster(b)} className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700">
                    <Users className="w-3.5 h-3.5" /> Students
                  </button>
                  <button type="button" onClick={() => setEditing(b)} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700">
                    Edit
                  </button>
                  <button type="button" onClick={() => setReassigning(b)} className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700">
                    <UserCog className="w-3.5 h-3.5" /> Teacher
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {createOpen && (
        <BatchFormDialog
          title="Create Batch"
          courses={courseOptions}
          teachers={teachers}
          catalogAvailable={catalogAvailable}
          onCancel={() => setCreateOpen(false)}
          onSubmit={async (values) => {
            await adminApi.createBatch(values);
            setCreateOpen(false);
            await load();
          }}
        />
      )}

      {editing && (
        <BatchFormDialog
          title={`Edit ${editing.name}`}
          batch={editing}
          courses={courseOptions}
          teachers={teachers}
          catalogAvailable={catalogAvailable}
          onCancel={() => setEditing(null)}
          onSubmit={async (values) => {
            await adminApi.updateBatch(editing.id, values);
            setEditing(null);
            await load();
          }}
        />
      )}

      {reassigning && (
        <ReassignDialog
          batch={reassigning}
          teachers={teachers}
          onCancel={() => setReassigning(null)}
          onSubmit={async (email) => {
            await adminApi.reassignBatchTeacher(reassigning.id, email);
            setReassigning(null);
            await load();
          }}
        />
      )}

      {roster && <RosterDialog batch={roster} onClose={() => setRoster(null)} />}
    </div>
  );
}

const field = 'w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm';

function Dialog({ title, children, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button type="button" onClick={onCancel} className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
        <h3 className="text-lg font-bold text-[#22355E] mb-4 pr-8">{title}</h3>
        {children}
      </div>
    </div>
  );
}

/**
 * Create/edit form.
 *
 * Editing deliberately does NOT offer the teacher: moving a batch between
 * teachers also moves its roster, so it is its own confirmed action rather than
 * one field among several in a general edit.
 */
function BatchFormDialog({ title, batch, courses, teachers, catalogAvailable, onCancel, onSubmit }) {
  const isEdit = Boolean(batch);
  const [form, setForm] = useState({
    courseSlug: batch?.courseSlug || '',
    name: batch?.name || '',
    teacherEmail: batch?.teacher?.email || '',
    capacity: String(batch?.capacity ?? 60),
    room: batch?.room || '',
    schedule: batch?.schedule || '',
    status: batch?.status || 'active',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const capacityNum = Number(form.capacity);
  const belowFilled = isEdit && Number.isFinite(capacityNum) && capacityNum < (batch?.enrolledCount || 0);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!form.name.trim()) return setErr('A batch name is required.');
    if (!isEdit && !form.courseSlug) return setErr('Choose the course this batch belongs to.');
    if (!isEdit && !form.teacherEmail) return setErr('Choose the teacher who will run this batch.');
    if (!Number.isFinite(capacityNum) || capacityNum < 1) return setErr('Capacity must be at least 1.');

    setBusy(true);
    try {
      const payload = isEdit
        ? { name: form.name.trim(), capacity: capacityNum, status: form.status, room: form.room || null, schedule: form.schedule || null }
        : {
            courseSlug: form.courseSlug,
            name: form.name.trim(),
            teacherEmail: form.teacherEmail,
            capacity: capacityNum,
            room: form.room || null,
            schedule: form.schedule || null,
          };
      await onSubmit(payload);
    } catch (error) {
      setErr(error.message || 'Could not save this batch.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title={title} onCancel={onCancel}>
      <form onSubmit={submit} className="space-y-3">
        {err && <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">{err}</div>}

        {!isEdit && (
          <>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Course *</label>
              <select value={form.courseSlug} onChange={(e) => setForm({ ...form, courseSlug: e.target.value })} className={field} disabled={!catalogAvailable}>
                <option value="">— Select a course —</option>
                {courses.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.title}</option>
                ))}
              </select>
              {!catalogAvailable && <p className="text-[11px] text-amber-700 mt-1">The catalogue is unreachable, so a batch cannot be created right now.</p>}
              {catalogAvailable && courses.length === 0 && (
                <p className="text-[11px] text-slate-500 mt-1">No course has a published slug yet — publish one first.</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Teacher *</label>
              <select value={form.teacherEmail} onChange={(e) => setForm({ ...form, teacherEmail: e.target.value })} className={field}>
                <option value="">— Select a teacher —</option>
                {teachers.map((t) => (
                  <option key={t._id || t.id} value={t.email}>{t.name} · {t.email}</option>
                ))}
              </select>
            </div>
          </>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Batch name *</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} placeholder="e.g. PB1" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Capacity *</label>
            <input type="number" min="1" max="500" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} className={field} />
            {belowFilled && (
              <p className="text-[11px] text-amber-700 mt-1">
                {batch.enrolledCount} students are already placed. Lowering capacity below that does not remove anyone — it
                only stops new placements.
              </p>
            )}
          </div>
          {isEdit && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={field}>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Room</label>
            <input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} className={field} placeholder="Online / Lab 1" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Schedule</label>
            <input value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })} className={field} placeholder="Mon, Wed 6:00 PM" />
          </div>
        </div>

        {isEdit && form.status === 'archived' && batch.status !== 'archived' && (
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex gap-2">
            <Archive className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>Archiving keeps the batch and its history, but no new student will be placed into it.</span>
          </div>
        )}

        <div className="pt-2 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-semibold">Cancel</button>
          <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-[#22355E] hover:bg-[#16233F] text-white text-sm font-semibold disabled:opacity-60">
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create batch'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** Reassignment is its own confirmed step because the roster moves with the batch. */
function ReassignDialog({ batch, teachers, onCancel, onSubmit }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const chosen = teachers.find((t) => t.email === email);

  return (
    <Dialog title={`Change teacher for ${batch.name}`} onCancel={onCancel}>
      <div className="space-y-3">
        {err && <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">{err}</div>}
        <p className="text-xs text-slate-500">
          Currently taught by <strong className="text-[#22355E]">{batch.teacher?.name || 'nobody'}</strong>.
        </p>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">New teacher</label>
          <select value={email} onChange={(e) => setEmail(e.target.value)} className={field}>
            <option value="">— Select a teacher —</option>
            {teachers.filter((t) => t.email !== batch.teacher?.email).map((t) => (
              <option key={t._id || t.id} value={t.email}>{t.name} · {t.email}</option>
            ))}
          </select>
        </div>
        {email && (
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex gap-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>
              All {batch.enrolledCount} student{batch.enrolledCount === 1 ? '' : 's'} in this batch move with it. The previous
              teacher immediately loses access to them.
            </span>
          </div>
        )}
        <div className="pt-2 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-semibold">Cancel</button>
          <button
            type="button"
            disabled={!email || busy}
            onClick={async () => {
              setBusy(true);
              setErr('');
              try {
                await onSubmit(email);
              } catch (error) {
                setErr(error.message || 'Could not reassign this batch.');
              } finally {
                setBusy(false);
              }
            }}
            className="px-4 py-2 rounded-lg bg-[#AB5236] hover:bg-[#94452C] text-white text-sm font-semibold disabled:opacity-60"
          >
            {busy ? 'Reassigning…' : chosen ? `Move to ${chosen.name}` : 'Select a teacher'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

function RosterDialog({ batch, onClose }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    adminApi
      .getBatchStudents(batch.id)
      .then(setRows)
      .catch((e) => setErr(e.message || 'Could not load this roster.'));
  }, [batch.id]);

  return (
    <Dialog title={`${batch.name} — ${batch.enrolledCount}/${batch.capacity}`} onCancel={onClose}>
      {err && <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs mb-3">{err}</div>}
      {rows === null && !err ? (
        <p className="text-sm text-slate-400 py-6 text-center">Loading students…</p>
      ) : rows && rows.length === 0 ? (
        <p className="text-sm text-slate-500 py-6 text-center">Nobody has been placed in this batch yet.</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400">
                <th className="py-2 px-1">Student</th>
                <th className="py-2 px-1">Enrollment ID</th>
                <th className="py-2 px-1">Verified</th>
              </tr>
            </thead>
            <tbody>
              {(rows || []).map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="py-2 px-1">
                    <p className="font-medium text-[#22355E]">{s.name}</p>
                    <p className="text-[11px] text-slate-400 truncate max-w-[190px]">{s.email}</p>
                  </td>
                  <td className="py-2 px-1 font-mono text-[11px] text-slate-600">{s.enrollmentId || '—'}</td>
                  <td className="py-2 px-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${s.verified ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {s.verified ? 'Verified' : 'Awaiting sync'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Dialog>
  );
}
