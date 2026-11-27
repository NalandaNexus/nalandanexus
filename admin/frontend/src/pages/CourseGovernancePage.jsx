import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { adminApi } from '../services/adminApi';
import { useRealtimeEvents } from '../hooks/useRealtimeEvents';
import CourseCard from '../components/courses/CourseCard';
import ManageCourseDialog from '../components/courses/ManageCourseDialog';
import ErrorState from '../components/common/ErrorState';
import EmptyState from '../components/common/EmptyState';

export default function CourseGovernancePage() {
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  // Whether the student catalogue (PRARAMBH, GARUD, YODDHA...) could be read.
  // When it cannot, the list is missing those courses and the page must say so.
  const [catalog, setCatalog] = useState({ available: true });
  const [managedCourse, setManagedCourse] = useState(null);
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
      setLoadError(null);
      const { items, meta } = await adminApi.getCoursesWithMeta({ limit: 100 });
      setCourses(items);
      setCatalog({
        available: meta.catalogAvailable !== false,
        reason: meta.catalogError,
        detail: meta.catalogErrorDetail,
        host: meta.catalogHost,
      });
    } catch (err) {
      setLoadError(err);
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

      {/* The student catalogue holds PRARAMBH, GARUD, YODDHA and the rest. When it
          cannot be read they are missing from the list below, and an empty page
          must never pass for "there are no courses". */}
      {!isLoading && !loadError && !catalog.available && (
        <div role="alert" className="bg-[#C1352B]/8 border border-[#C1352B]/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#C1352B]/15 text-[#C1352B] flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <h3 className="text-xs font-bold text-[#22355E]">
                The student course catalogue could not be loaded, so PRARAMBH, GARUD, YODDHA and the other catalogue courses are missing below
              </h3>
              <p className="text-[11px] text-[#2B2B28]/80 leading-relaxed">
                {catalog.reason === 'NOT_CONFIGURED'
                  ? 'This Admin service has no Student service address configured (STUDENT_BACKEND_URL).'
                  : <>
                      This Admin service tried the Student service at{' '}
                      <code className="font-mono bg-white/70 px-1 rounded">{catalog.host || 'its configured address'}</code>
                      {catalog.detail ? <> and got: {catalog.detail}</> : null}. If that is not the live Student service, set STUDENT_BACKEND_URL on
                      this Admin service to the Student service's address. If it is, the Student service may still be waking up; retry in a minute.
                    </>}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchCourses}
            className="px-3.5 py-1.5 rounded-xl bg-white border border-[#DFDACB] hover:bg-[#EDEAE0] text-xs font-semibold text-[#22355E] flex items-center gap-1.5 flex-shrink-0 self-start"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Courses */}
      {isLoading && courses.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-64 rounded-2xl bg-white border border-[#DFDACB] animate-pulse" />
          ))}
        </div>
      ) : loadError ? (
        <ErrorState error={loadError} onRetry={fetchCourses} title="Courses could not be loaded" />
      ) : courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No courses to show"
          description={
            catalog.available
              ? 'Neither this portal nor the student catalogue has any courses yet. Use Create Course to add one.'
              : 'Nothing could be read from the student catalogue (see above), and this portal has no courses of its own.'
          }
          actionText="Reload"
          onAction={fetchCourses}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              onManage={setManagedCourse}
              onApprove={(c) => handleUpdateStatus(c.id, 'APPROVED')}
              onReject={(c) => handleUpdateStatus(c.id, 'REJECTED')}
            />
          ))}
        </div>
      )}

      <ManageCourseDialog course={managedCourse} onClose={() => setManagedCourse(null)} />

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
