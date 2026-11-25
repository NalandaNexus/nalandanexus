import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Youtube, GraduationCap, Layers, Tags, ShieldCheck, SlidersHorizontal, Ticket, ArrowRight, FolderTree } from 'lucide-react';
import { splitCourseTitle, isCourseActive, moduleAndLessonCounts } from './CourseCard';

/**
 * Everything about one course in one place, and the screens that manage it.
 *
 * A student-catalogue course (PRARAMBH, GARUD, YODDHA...) is defined by the
 * student service, which every portal reads: its videos, subjects, batches,
 * stage rules, coupons and teachers are managed from the screens below, and each
 * change reaches the Teacher and Student portals from there. This dialog does
 * not keep a second copy of any of it.
 */
const MANAGE_LINKS = [
  { label: 'Teachers', description: 'Assign teachers to this course', path: '/teachers', icon: GraduationCap },
  { label: 'Course Content', description: 'Rename, reorder, add or remove modules and lessons', path: '/course-content', icon: FolderTree },
  { label: 'Lesson Videos', description: 'Module and lesson videos', path: '/lesson-videos', icon: Youtube },
  { label: 'Batches', description: 'Batches, capacity and batch teachers', path: '/batches', icon: Layers },
  { label: 'Course Subjects', description: 'Subjects taught in the course', path: '/course-subjects', icon: Tags },
  { label: 'Stage Eligibility', description: 'What each stage requires', path: '/stage-eligibility', icon: ShieldCheck },
  { label: 'Progression', description: 'Stage progression rules', path: '/progression', icon: SlidersHorizontal },
  { label: 'Coupons', description: 'Free and discounted access', path: '/coupons', icon: Ticket },
];

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-[#EDEAE0] last:border-b-0">
      <dt className="text-[11px] text-[#9B9690]">{label}</dt>
      <dd className="text-xs font-semibold text-[#2B2B28] text-right">{children}</dd>
    </div>
  );
}

export default function ManageCourseDialog({ course, onClose }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!course) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [course, onClose]);

  if (!course) return null;
  const { name, fullName } = splitCourseTitle(course);
  const { modules, lessons } = moduleAndLessonCounts(course);
  const price = typeof course.priceInPaise === 'number' ? `₹${(course.priceInPaise / 100).toLocaleString('en-IN')}` : '—';

  return (
    <div className="fixed inset-0 z-50 bg-[#22355E]/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Manage ${name}`}
        className="bg-white border border-[#DFDACB] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[11px] text-[#9B9690]">{course.slug || course.code}</p>
            <h3 className="text-xl font-bold text-[#22355E] leading-tight">{name}</h3>
            {fullName && <p className="text-sm font-semibold text-[#AB5236]">{fullName}</p>}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#9B9690] hover:text-[#2B2B28] hover:bg-[#EDEAE0] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {course.description && <p className="text-xs text-[#2B2B28] leading-relaxed">{course.description}</p>}

        <dl className="p-4 rounded-xl bg-[#F7F5EE] border border-[#DFDACB]">
          <Row label="Status">{isCourseActive(course) ? 'Active' : 'Inactive'}</Row>
          <Row label="Enrolment">{course.isPurchasable === false ? 'Not open yet' : 'Open'}</Row>
          <Row label="Duration">{course.duration || '—'}</Row>
          <Row label="Modules">{modules ?? '—'}</Row>
          <Row label="Lessons">{lessons ?? '—'}</Row>
          <Row label="Price">{price}</Row>
          <Row label="Teachers assigned">{course.assignedTeachersCount ?? 0}</Row>
          <Row label="Students enrolled">{course.enrolledStudentsCount ?? 0}</Row>
          <Row label="Defined in">{course.readOnly ? 'Student catalogue (shared by all portals)' : 'Admin Portal'}</Row>
        </dl>

        <div>
          <h4 className="text-xs font-bold text-[#22355E] mb-2">Manage</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {MANAGE_LINKS.map(({ label, description, path, icon: Icon }) => (
              <button
                key={path}
                type="button"
                onClick={() => {
                  onClose();
                  navigate(path);
                }}
                className="text-left p-3 rounded-xl border border-[#DFDACB] hover:border-[#22355E]/40 hover:bg-[#F7F5EE] transition-colors flex items-center gap-3 group"
              >
                <span className="w-8 h-8 rounded-lg bg-[#22355E]/8 text-[#22355E] flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-[#22355E]">{label}</span>
                  <span className="block text-[11px] text-[#9B9690] truncate">{description}</span>
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-[#9B9690] group-hover:text-[#22355E]" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
