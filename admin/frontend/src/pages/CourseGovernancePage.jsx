import React, { useState, useEffect } from 'react';
import { BookOpen, Check, X, ShieldCheck, Plus, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import StatusBadge from '../components/common/StatusBadge';
import { adminApi } from '../services/adminApi';
import { useRealtimeEvents } from '../hooks/useRealtimeEvents';

export default function CourseGovernancePage() {
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  const emptyFormData = {
    code: '',
    title: '',
    instructor: '',
    department: 'Computer Science',
    credits: 4,
    description: '',
    features: '',
    price: '',
    imageFile: null,
  };
  const [formData, setFormData] = useState(emptyFormData);

  const showToast = (msg, type = 'success') => {
    setToastMsg({ msg, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const fetchCourses = async () => {
    try {
      setIsLoading(true);
      const data = await adminApi.getCourses({ limit: 100 });
      setCourses(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
    adminApi
      .getTeachers({ status: 'ACTIVE', limit: 100 })
      .then(setTeachers)
      .catch(() => showToast('Could not load instructors — the instructor dropdown will be empty.', 'error'));
  }, []);

  useRealtimeEvents(['course.created', 'course.updated', 'course.deleted'], fetchCourses);

  const handleUpdateStatus = async (courseId, newStatus) => {
    try {
      await adminApi.updateCourseStatus(courseId, newStatus);
      showToast(`Course status updated to ${newStatus}`);
      fetchCourses();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    try {
      const { imageFile, price, ...rest } = formData;
      const payload = { ...rest };
      if (!payload.instructor) delete payload.instructor;
      if (price) payload.priceInPaise = Math.round(Number(price) * 100);
      if (imageFile) payload.image = imageFile;
      await adminApi.createCourse(payload);
      showToast(`Course "${formData.title}" submitted for governance review.`);
      setCreateModalOpen(false);
      setFormData(emptyFormData);
      fetchCourses();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const pendingCount = courses.filter((c) => c.status === 'PENDING_REVIEW').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-[#22355E] text-white border border-[#22355E] shadow-2xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-[#5C7A5E]" />
          <span className="text-xs font-semibold">{toastMsg.msg}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#DFDACB]/80 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#22355E]">Course Governance & Accreditation</h1>
          <p className="text-xs text-[#9B9690] mt-1">
            Audit curriculum syllabus compliance, review proposed courses, and manage institutional credits.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-[#22355E] hover:bg-[#1A2A4A] text-white text-xs font-semibold transition-all shadow-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Course</span>
          </button>
        </div>
      </div>

      {/* Governance Triage Banner if pending reviews exist */}
      {pendingCount > 0 && (
        <div className="bg-[#C99A2E]/10 border border-[#C99A2E]/30 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#C99A2E]/20 text-[#C99A2E] flex items-center justify-center font-bold">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#22355E]">
                {pendingCount} Course Syllabus Submissions Pending Super Admin Approval
              </h3>
              <p className="text-[11px] text-[#2B2B28]/80">
                Curriculum submissions must be signed off before term registration opens.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Courses List */}
      <div className="space-y-3">
        {courses.map((course) => {
          const isPending = course.status === 'PENDING_REVIEW';

          return (
            <div
              key={course.id}
              className={`p-5 rounded-2xl bg-white border transition-all shadow-card hover:shadow-hover flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                isPending ? 'border-[#C99A2E]' : 'border-[#DFDACB]'
              }`}
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-bold text-xs bg-[#EDEAE0] text-[#22355E] px-2 py-0.5 rounded">
                    {course.code}
                  </span>
                  <h3 className="text-sm font-bold text-[#22355E] truncate">{course.title}</h3>
                  <StatusBadge status={course.status} size="xs" />
                  {/* Says why this course has no review actions: it is defined in
                      the student catalogue, so this portal has no record to act
                      on. Without the badge it just looks like a broken card. */}
                  {course.readOnly && (
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider bg-[#22355E]/8 text-[#22355E] border border-[#22355E]/20 px-2 py-0.5 rounded"
                      title="Defined in the student catalogue — managed there, shown here for reference and selection"
                    >
                      Student catalogue
                    </span>
                  )}
                </div>

                <p className="text-xs text-[#9B9690]">
                  Lead Instructor: <strong className="text-[#2B2B28]">{course.instructor?.name || 'Unassigned'}</strong>
                  {course.department ? <> • Department of {course.department}</> : null}
                  {typeof course.priceInPaise === 'number' && (
                    <> • <strong className="text-[#2B2B28]">₹{(course.priceInPaise / 100).toLocaleString('en-IN')}</strong></>
                  )}
                </p>

                {course.notes && (
                  <p className="text-xs text-[#C99A2E] bg-[#C99A2E]/10 p-2 rounded-lg border border-[#C99A2E]/20">
                    <strong>Review Note:</strong> {course.notes}
                  </p>
                )}

                <div className="flex items-center gap-4 text-[11px] text-[#9B9690] pt-1">
                  {/* Credits and module counts are this portal's own bookkeeping;
                      a catalogue entry has neither, and printing "undefined
                      Academic Credits" would be worse than omitting them. */}
                  {!course.readOnly && (
                    <>
                      <span><strong>{course.credits}</strong> Academic Credits</span>
                      <span>•</span>
                      <span><strong>{course.modulesCount || 0}</strong> Modules</span>
                    </>
                  )}
                  {course.status === 'APPROVED' && (
                    <>
                      <span>•</span>
                      <span className="text-[#5C7A5E] font-semibold">{course.completionRate}% Completion Rate</span>
                    </>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-shrink-0 self-end md:self-auto">
                {isPending ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(course.id, 'APPROVED')}
                      className="px-3.5 py-1.5 rounded-xl bg-[#5C7A5E] hover:bg-[#4A644C] text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve Syllabus</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(course.id, 'REJECTED')}
                      className="px-3.5 py-1.5 rounded-xl bg-[#C1352B]/10 hover:bg-[#C1352B] text-[#C1352B] hover:text-white border border-[#C1352B]/30 text-xs font-semibold transition-colors flex items-center gap-1.5"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Course Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#22355E]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#DFDACB] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#22355E]">Create Institutional Course</h3>
            <form onSubmit={handleCreateCourse} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#2B2B28] mb-1">Course Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Distributed Operating Systems"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs text-[#2B2B28] focus:outline-none focus:border-[#22355E]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-[#2B2B28] mb-1">Course Code</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3 py-2 text-xs font-mono text-[#2B2B28]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#2B2B28] mb-1">Credits</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={formData.credits}
                    onChange={(e) => setFormData({ ...formData, credits: Number(e.target.value) })}
                    className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3 py-2 text-xs font-mono text-[#2B2B28]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#2B2B28] mb-1">Lead Instructor</label>
                <select
                  value={formData.instructor}
                  onChange={(e) => setFormData({ ...formData, instructor: e.target.value })}
                  className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs text-[#2B2B28]"
                >
                  <option value="">Unassigned</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} — {t.department}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#2B2B28] mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="What students will learn in this course..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs text-[#2B2B28] focus:outline-none focus:border-[#22355E]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#2B2B28] mb-1">Features (one per line)</label>
                <textarea
                  rows={3}
                  placeholder={'Live weekly cohort classes\nGraded assignments & certificate\n1:1 mentor support'}
                  value={formData.features}
                  onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                  className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs text-[#2B2B28] focus:outline-none focus:border-[#22355E]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-[#2B2B28] mb-1">Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0 = free course"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3 py-2 text-xs font-mono text-[#2B2B28]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#2B2B28] mb-1">Cover Image</label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={(e) => setFormData({ ...formData, imageFile: e.target.files?.[0] || null })}
                    className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-2 py-1.5 text-[11px] text-[#2B2B28]"
                  />
                </div>
              </div>
              <p className="text-[11px] text-[#9B9690]">
                A price and cover image are required for this course to become purchasable once approved — a course
                left at ₹0 with no image can still be approved, but will only appear as a free listing.
              </p>
              <div className="pt-3 border-t border-[#EDEAE0] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#EDEAE0] text-xs font-semibold text-[#2B2B28]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#22355E] hover:bg-[#1A2A4A] text-white text-xs font-semibold"
                >
                  Submit for Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
