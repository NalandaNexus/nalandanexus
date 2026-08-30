import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ArrowUpRight, Search, Plus, X, RefreshCw, Link2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { teacherApiService, ApiClientError } from '../services/teacherApiService';
import { socketService } from '../services/socketService';
import CourseMappingDialog from '../components/classes/CourseMappingDialog';

/**
 * How each backend linkState reads on the card.
 *
 * Every one of these was previously collapsed into either "Verified enrollment
 * enabled" or "No linked course", which told a teacher that a batch nobody has
 * bought was working exactly like one serving real students. Mapping success,
 * finding enrollments, and linking them are separate facts and each gets its
 * own words.
 */
const LINK_STATES = {
  UNLINKED: {
    label: 'Course mapping required',
    tone: 'bg-[#C99A2E]/15 text-[#8F6A15] border-[#C99A2E]/30',
    detail: 'Enrollment cannot be checked until this batch points at a course.',
  },
  LINK_BROKEN: {
    label: 'Linked course missing',
    tone: 'bg-[#C1352B]/15 text-[#C1352B] border-[#C1352B]/30',
    detail: 'The linked course is no longer published. Pick a current one to restore sync.',
  },
  LINKED_NO_ENROLLMENT: {
    label: 'Mapped — no enrollments yet',
    tone: 'bg-[#EDEAE0] text-[#6E6A64] border-[#DFDACB]',
    detail: 'The course link works. Nobody has an active enrollment in it yet.',
  },
  LINKED_VERIFIED: {
    label: 'Verified enrollment',
    tone: 'bg-[#5C7A5E]/15 text-[#5C7A5E] border-[#5C7A5E]/30',
    detail: null,
  },
};

/** Turns a real sync response into a sentence, without ever implying students were found when none were. */
function describeSync(result) {
  if (!result) return null;
  if (result.outcome === 'NOT_LINKED') {
    return { tone: 'warn', text: 'This batch is not linked to a course yet, so nothing could be checked.' };
  }
  if (result.outcome === 'NO_ENROLLMENTS') {
    return { tone: 'warn', text: 'Course link is working — no active enrollments found for it yet.' };
  }
  const parts = [];
  if (result.created) parts.push(`${result.created} added`);
  if (result.linked) parts.push(`${result.linked} verified`);
  if (result.unlinked) parts.push(`${result.unlinked} no longer enrolled`);
  const detail = parts.length ? ` (${parts.join(', ')})` : ' (already up to date)';
  return { tone: 'ok', text: `${result.totalEnrolled} enrolled student(s) found${detail}.` };
}

export default function ClassesPage() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('all');

  const [createOpen, setCreateOpen] = useState(false);
  const [courseOptions, setCourseOptions] = useState([]);
  const [catalogAvailable, setCatalogAvailable] = useState(true);
  const [form, setForm] = useState({ name: '', studentCourseSlug: '', room: '', schedule: '', capacity: '' });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  const [syncError, setSyncError] = useState('');
  const [syncResults, setSyncResults] = useState({});

  // The batch whose mapping is being edited, plus that dialog's own save state.
  const [mappingBatch, setMappingBatch] = useState(null);
  const [isMapping, setIsMapping] = useState(false);
  const [mappingError, setMappingError] = useState('');

  const fetchClasses = useCallback(async () => {
    try {
      setError(null);
      const data = await teacherApiService.getClasses();
      setClasses(data || []);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load classes.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    teacherApiService
      .getStudentCourseOptions()
      .then(({ courses, catalogAvailable: available }) => {
        setCourseOptions(courses);
        setCatalogAvailable(available);
      })
      .catch(() => setCatalogAvailable(false));
  }, []);

  useEffect(() => {
    socketService.connect();
    const unbind = socketService.on('score:update', fetchClasses);
    return unbind;
  }, [fetchClasses]);

  const courseFilters = ['all', ...new Set(classes.map((c) => c.courseTitle).filter(Boolean))];

  const filtered = classes.filter((c) => {
    const matchSearch = c.name?.toLowerCase().includes(search.toLowerCase()) || c.courseTitle?.toLowerCase().includes(search.toLowerCase());
    const matchCourse = selectedCourse === 'all' || c.courseTitle === selectedCourse;
    return matchSearch && matchCourse;
  });

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.studentCourseSlug) {
      setFormError('Batch name and course are required.');
      return;
    }
    setIsSubmitting(true);
    setFormError('');
    try {
      await teacherApiService.createClass({
        ...form,
        capacity: form.capacity ? Number(form.capacity) : undefined,
      });
      setCreateOpen(false);
      setForm({ name: '', studentCourseSlug: '', room: '', schedule: '', capacity: '' });
      fetchClasses();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : 'Failed to create class.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Saves a batch's course mapping.
   *
   * Batches created before the course-link feature carry no studentCourseSlug,
   * and syncEnrollmentForClass returns NOT_LINKED before it ever calls the
   * student portal — so their roster can never be verified and their student
   * count is stuck at 0 forever. The API has always supported setting it
   * (PATCH /classes/:id, wrapped by teacherApiService.updateClass), but nothing
   * in the UI ever called it, leaving a teacher no way to repair such a batch
   * from inside the product. Only studentCourseSlug is sent; the backend
   * validates it against the live catalogue and rejects anything else.
   */
  const handleSaveMapping = async (slug) => {
    if (!slug || !mappingBatch) return;
    setIsMapping(true);
    setMappingError('');
    try {
      await teacherApiService.updateClass(mappingBatch.id, { studentCourseSlug: slug });
      setMappingBatch(null);
      // The mapping saving and enrollment being found are separate outcomes, so
      // a stale sync result from before the change must not be left on screen.
      setSyncResults((prev) => ({ ...prev, [mappingBatch.id]: null }));
      await fetchClasses();
    } catch (err) {
      setMappingError(err instanceof ApiClientError ? err.message : 'Could not save the course mapping.');
    } finally {
      setIsMapping(false);
    }
  };

  const handleSync = async (classId) => {
    setSyncingId(classId);
    setSyncError('');
    try {
      const result = await teacherApiService.syncClassEnrollment(classId);
      setSyncResults((prev) => ({ ...prev, [classId]: result }));
      await fetchClasses();
    } catch (err) {
      setSyncResults((prev) => ({ ...prev, [classId]: null }));
      setSyncError(err instanceof ApiClientError ? err.message : 'Sync failed — the roster was left exactly as it was.');
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#22355E] font-display">My Classes</h1>
          <p className="text-xs text-[#6E6A64] mt-1">
            {isLoading ? 'Loading…' : `Managing ${classes.length} active class${classes.length === 1 ? '' : 'es'}.`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 bg-[#AB5236] hover:bg-[#94452C] text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-cta"
        >
          <Plus className="w-4 h-4" /> Create Class
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-[#C1352B]/10 border border-[#C1352B]/30 text-[#C1352B] text-xs font-medium flex items-center justify-between">
          {error}
          <button type="button" onClick={fetchClasses} className="font-bold underline">Retry</button>
        </div>
      )}

      {syncError && (
        <div className="p-3.5 rounded-xl bg-[#C1352B]/10 border border-[#C1352B]/30 text-[#C1352B] text-xs font-medium flex items-center justify-between">
          {syncError}
          <button type="button" onClick={() => setSyncError('')} className="font-bold underline">Dismiss</button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[#FFFFFF] border border-[#DFDACB]">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6E6A64]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search batches or courses..."
            className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#2B2B28] placeholder-[#6E6A64] focus:outline-none focus:border-[#22355E]"
          />
        </div>

        {courseFilters.length > 1 && (
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="text-[#6E6A64] font-semibold">Course:</span>
            {courseFilters.map((c) => (
              <button
                key={c}
                onClick={() => setSelectedCourse(c)}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  selectedCourse === c ? 'bg-[#22355E] text-white shadow-xs' : 'text-[#6E6A64] hover:text-[#2B2B28]'
                }`}
              >
                {c === 'all' ? 'All' : c}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-xs text-[#9B9690] bg-white rounded-2xl border border-[#DFDACB]">Loading classes…</div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-xs text-[#9B9690] bg-white rounded-2xl border border-[#DFDACB]">
          {classes.length === 0 ? 'No classes created yet.' : 'No classes match your search.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {filtered.map((cls) => {
            const isAction = cls.riskLevel === 'act_now';
            const isWatch = cls.riskLevel === 'watch';
            const state = LINK_STATES[cls.linkState] || LINK_STATES.UNLINKED;
            const needsMapping = cls.linkState === 'UNLINKED' || cls.linkState === 'LINK_BROKEN';
            const syncSummary = describeSync(syncResults[cls.id]);

            return (
              <div
                key={cls.id}
                className="p-5 rounded-2xl bg-[#FFFFFF] border border-[#DFDACB] hover:border-[#22355E] transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#22355E] bg-[#EDEAE0] border border-[#DFDACB] px-2.5 py-0.5 rounded-full font-mono truncate max-w-[70%]">
                      {cls.courseTitle || 'No linked course'}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded border flex-shrink-0 ${
                        isAction
                          ? 'bg-[#C1352B]/15 text-[#C1352B] border-[#C1352B]/30'
                          : isWatch
                          ? 'bg-[#C99A2E]/15 text-[#8F6A15] border-[#C99A2E]/30'
                          : 'bg-[#5C7A5E]/15 text-[#5C7A5E] border-[#5C7A5E]/30'
                      }`}
                    >
                      {isAction ? 'Action' : isWatch ? 'Watch' : 'Good'}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-[#22355E] group-hover:text-[#AB5236] transition-colors mt-3">{cls.name}</h3>

                  {/* Without a course link a batch is permanently stuck: sync
                      short-circuits on the missing slug, so its roster can never
                      be verified and its student count stays 0. */}
                  <div className="mt-2 space-y-1.5">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${state.tone}`}>
                      {cls.linkState === 'LINKED_VERIFIED' ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : cls.linkState === 'UNLINKED' || cls.linkState === 'LINK_BROKEN' ? (
                        <AlertTriangle className="w-3 h-3" />
                      ) : null}
                      {state.label}
                    </span>
                    {state.detail && <p className="text-[10px] text-[#9B9690] leading-snug">{state.detail}</p>}

                    {needsMapping ? (
                      <button
                        type="button"
                        onClick={() => {
                          setMappingError('');
                          setMappingBatch(cls);
                        }}
                        className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold px-2 py-1.5 rounded-lg bg-[#22355E] hover:bg-[#16233F] text-white transition-colors"
                      >
                        <Link2 className="w-3 h-3" /> Set course mapping
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setMappingError('');
                          setMappingBatch(cls);
                        }}
                        className="text-[10px] font-semibold text-[#6E6A64] hover:text-[#22355E] underline underline-offset-2"
                      >
                        Change course
                      </button>
                    )}

                    {syncSummary && (
                      <p
                        className={`text-[10px] leading-snug ${
                          syncSummary.tone === 'ok' ? 'text-[#5C7A5E]' : 'text-[#8F6A15]'
                        }`}
                      >
                        {syncSummary.text}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-[#DFDACB] text-center">
                    {/* Occupancy against capacity, taken from the backend's own
                        seat counter - the number placement is enforced against.
                        A bare student count hid whether a batch had room. */}
                    <div className="p-2 rounded-lg bg-[#F7F5EE] border border-[#DFDACB]">
                      <span className="text-[10px] text-[#6E6A64]">Enrolled</span>
                      <div className="text-xs font-bold text-[#22355E] font-mono tabular-nums">
                        {cls.enrolledCount ?? cls.studentCount} / {cls.capacity}
                      </div>
                      <div className="text-[9px] mt-0.5 font-semibold" style={{ color: cls.isFull ? '#8F6A15' : '#5C7A5E' }}>
                        {cls.isFull ? 'Full' : `${cls.seatsRemaining} left`}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-[#F7F5EE] border border-[#DFDACB]">
                      <span className="text-[10px] text-[#6E6A64]">Avg. Score</span>
                      <div className="text-xs font-bold text-[#22355E] font-mono tabular-nums">{cls.averageScore}%</div>
                    </div>
                    <div className="p-2 rounded-lg bg-[#F7F5EE] border border-[#DFDACB]">
                      <span className="text-[10px] text-[#6E6A64]">Attendance</span>
                      <div className="text-xs font-bold text-[#22355E] font-mono tabular-nums">{cls.attendanceRate}%</div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-[#DFDACB] flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[#6E6A64] font-mono truncate">{cls.room || '—'}</span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {cls.studentCourseSlug && (
                      <button
                        type="button"
                        onClick={() => handleSync(cls.id)}
                        disabled={syncingId === cls.id}
                        title="Sync verified enrollment from the student portal"
                        className="p-1.5 rounded-xl bg-[#F7F5EE] hover:bg-[#EDEAE0] text-[#22355E] border border-[#DFDACB] transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${syncingId === cls.id ? 'animate-spin' : ''}`} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => navigate(`/students?classId=${cls.id}`)}
                      className="px-3 py-1 rounded-xl bg-[#22355E] hover:bg-[#16233F] text-xs font-bold text-white transition-colors flex items-center gap-1 shadow-xs"
                    >
                      Roster <ArrowUpRight className="w-3 h-3 text-[#C99A2E]" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {mappingBatch && (
        <CourseMappingDialog
          batch={mappingBatch}
          courses={courseOptions}
          catalogAvailable={catalogAvailable}
          isSaving={isMapping}
          error={mappingError}
          onCancel={() => {
            setMappingBatch(null);
            setMappingError('');
          }}
          onConfirm={handleSaveMapping}
        />
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 bg-[#22355E]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#DFDACB] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button type="button" onClick={() => setCreateOpen(false)} className="absolute right-4 top-4 p-1.5 rounded-lg text-[#9B9690] hover:bg-[#EDEAE0]">
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-base font-bold text-[#22355E] mb-1">Create Class</h3>
            <p className="text-[11px] text-[#9B9690] mb-4">A class is a batch of students taking one of your courses — e.g. a "Morning Batch" of your JEE Physics course.</p>
            <form onSubmit={handleCreate} className="space-y-3">
              {formError && <div className="p-2.5 rounded-xl bg-[#C1352B]/10 border border-[#C1352B]/30 text-[#C1352B] text-xs">{formError}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-[#2B2B28] mb-1">Course *</label>
                  <select
                    value={form.studentCourseSlug}
                    onChange={(e) => setForm({ ...form, studentCourseSlug: e.target.value })}
                    className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs"
                  >
                    <option value="">— Select a course —</option>
                    {courseOptions.map((c) => (
                      <option key={c.slug} value={c.slug}>{c.title}</option>
                    ))}
                  </select>
                  {!catalogAvailable ? (
                    <p className="text-[10px] text-[#8F6A15] mt-1">The course catalogue is unreachable right now, so a batch cannot be created — please try again in a moment.</p>
                  ) : courseOptions.length === 0 ? (
                    <p className="text-[10px] text-[#9B9690] mt-1">No courses available yet — courses are published from the catalog before a class can be created for them.</p>
                  ) : null}
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-[#2B2B28] mb-1">Batch Name *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs" placeholder="e.g. Morning Batch A" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#2B2B28] mb-1">Room</label>
                  <input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs" placeholder="e.g. Lab 1 / Online" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#2B2B28] mb-1">Capacity</label>
                  <input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-[#2B2B28] mb-1">Recurring Schedule</label>
                  <input value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })} className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs" placeholder="e.g. Mon, Wed, Fri 3:00 PM" />
                </div>
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 rounded-xl bg-[#EDEAE0] hover:bg-[#DFDACB] text-xs font-semibold">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 rounded-xl bg-[#AB5236] hover:bg-[#94452C] text-white text-xs font-bold disabled:opacity-60">
                  {isSubmitting ? 'Creating…' : 'Create Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
