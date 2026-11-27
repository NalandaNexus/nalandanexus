import React from 'react';
import { Clock, Layers, GraduationCap, Users, Settings2, Check, X } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';

/**
 * "GARUD — The Rise" is a programme name and its full name. Catalogue titles are
 * written that way; a course without the dash falls back to its subtitle.
 */
export function splitCourseTitle(course) {
  const parts = String(course?.title || '').split(/\s+[—–-]\s+/);
  if (parts.length > 1) return { name: parts[0], fullName: parts.slice(1).join(' — ') };
  return { name: course?.title || 'Untitled course', fullName: course?.subtitle || null };
}

/**
 * Active means students can see the course: a student-catalogue course is only
 * listed while it is published, and one of this portal's own courses is only
 * published once approved.
 */
export function isCourseActive(course) {
  return Boolean(course?.readOnly) || course?.status === 'APPROVED';
}

export function moduleAndLessonCounts(course) {
  const modules = Number.isFinite(course?.totalModules) ? course.totalModules : Number.isFinite(course?.modulesCount) ? course.modulesCount : null;
  const lessons = Number.isFinite(course?.totalLessons) ? course.totalLessons : null;
  return { modules, lessons };
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="w-7 h-7 rounded-lg bg-[#F7F5EE] border border-[#EDEAE0] flex items-center justify-center text-[#22355E] flex-shrink-0">
        <Icon className="w-3.5 h-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-[#9B9690]">{label}</p>
        <p className="text-xs font-semibold text-[#2B2B28] truncate">{value}</p>
      </div>
    </div>
  );
}

/** One course: what it is, how big it is, whether it is live, who teaches it and how many study it. */
export default function CourseCard({ course, onManage, onApprove, onReject }) {
  const { name, fullName } = splitCourseTitle(course);
  const active = isCourseActive(course);
  const { modules, lessons } = moduleAndLessonCounts(course);
  const isPending = course.status === 'PENDING_REVIEW';
  const count = (n, one, many) => `${n ?? 0} ${(n ?? 0) === 1 ? one : many}`;

  return (
    <article
      className={`p-5 rounded-2xl bg-white border transition-all shadow-card hover:shadow-hover flex flex-col gap-4 ${
        isPending ? 'border-[#C99A2E]' : 'border-[#DFDACB]'
      }`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${
            active ? 'bg-[#5C7A5E]/15 text-[#5C7A5E] border-[#5C7A5E]/30' : 'bg-[#9B9690]/10 text-[#6f6b66] border-[#9B9690]/30'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-[#5C7A5E]' : 'bg-[#9B9690]'}`} />
          {active ? 'Active' : 'Inactive'}
        </span>
        {/* This portal's own courses go through review; that state is still shown. */}
        {!course.readOnly && <StatusBadge status={course.status} size="xs" />}
        {course.readOnly && (
          <span
            className="text-[10px] font-semibold uppercase tracking-wider bg-[#22355E]/8 text-[#22355E] border border-[#22355E]/20 px-2 py-0.5 rounded"
            title="Defined in the student catalogue, which every portal reads"
          >
            Student catalogue
          </span>
        )}
        {course.isPurchasable === false && (
          <span
            className="text-[10px] font-semibold uppercase tracking-wider bg-[#C99A2E]/15 text-[#8a6a1c] border border-[#C99A2E]/30 px-2 py-0.5 rounded"
            title="Published, but not yet open for enrolment"
          >
            Enrolment not open
          </span>
        )}
      </div>

      <div className="min-w-0">
        <h3 className="text-lg font-bold text-[#22355E] leading-tight truncate">{name}</h3>
        {fullName && <p className="text-xs font-semibold text-[#AB5236] mt-0.5 truncate">{fullName}</p>}
        {course.description && <p className="text-xs text-[#9B9690] mt-2 leading-relaxed line-clamp-2">{course.description}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat icon={Clock} label="Duration" value={course.duration || '—'} />
        <Stat
          icon={Layers}
          label="Modules · Lessons"
          value={modules === null && lessons === null ? '—' : `${modules ?? '—'} · ${lessons ?? '—'}`}
        />
        <Stat icon={GraduationCap} label="Teachers" value={count(course.assignedTeachersCount, 'assigned', 'assigned')} />
        <Stat icon={Users} label="Students" value={count(course.enrolledStudentsCount, 'enrolled', 'enrolled')} />
      </div>

      {course.notes && (
        <p className="text-xs text-[#C99A2E] bg-[#C99A2E]/10 p-2 rounded-lg border border-[#C99A2E]/20">
          <strong>Review Note:</strong> {course.notes}
        </p>
      )}

      <div className="mt-auto pt-3 border-t border-[#EDEAE0] flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onManage(course)}
          className="px-3.5 py-1.5 rounded-xl bg-[#22355E] hover:bg-[#1A2A4A] text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span>Manage Course</span>
        </button>
        {isPending && onApprove && (
          <button
            type="button"
            onClick={() => onApprove(course)}
            className="px-3 py-1.5 rounded-xl bg-[#5C7A5E] hover:bg-[#4A644C] text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Approve</span>
          </button>
        )}
        {isPending && onReject && (
          <button
            type="button"
            onClick={() => onReject(course)}
            className="px-3 py-1.5 rounded-xl bg-[#C1352B]/10 hover:bg-[#C1352B] text-[#C1352B] hover:text-white border border-[#C1352B]/30 text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" />
            <span>Reject</span>
          </button>
        )}
      </div>
    </article>
  );
}
