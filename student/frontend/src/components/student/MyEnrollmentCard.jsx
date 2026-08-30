import React, { useEffect, useState } from 'react';
import { BadgeCheck, Users, GraduationCap, AlertCircle } from 'lucide-react';
import { courseService } from '../../services/courseService';

/**
 * The student's own enrollment details.
 *
 * A coaching student's first questions are which batch they are in and who
 * teaches it, and support asks them for their enrollment ID. All three existed
 * in the database and appeared on no screen, so a student had no way to answer
 * any of them.
 *
 * `enrollmentId` here is the business identifier (ENR-YYYY-NNNNNN), not a
 * database key — the API previously sent the internal id under that name.
 */
export default function MyEnrollmentCard() {
  const [enrollments, setEnrollments] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    courseService
      .getMyCourses()
      .then((rows) => {
        if (!cancelled) setEnrollments(Array.isArray(rows) ? rows : []);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Could not load your enrollment.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Nothing to show before the first course is bought — this is a detail panel,
  // not an empty-state prompt, and the dashboard already handles that case.
  if (error || !enrollments || enrollments.length === 0) return null;

  return (
    <section className="bg-white rounded-2xl border border-[#DFDACB] p-5 sm:p-6">
      <h2 className="font-heading font-bold text-[#22355E] text-base mb-4 flex items-center gap-2">
        <BadgeCheck className="w-4 h-4 text-[#5C7A5E]" /> My Enrollment
      </h2>

      <div className="space-y-4">
        {enrollments.map((e) => (
          <div key={e.courseId} className="rounded-xl border border-[#DFDACB] bg-[#F7F5EE] p-4">
            <h3 className="font-heading font-bold text-[#22355E] text-sm leading-snug">{e.title}</h3>
            {e.subtitle && <p className="text-[11px] text-[#2B2B28]/60 mt-0.5">{e.subtitle}</p>}

            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-[#2B2B28]/50">Enrollment ID</dt>
                <dd className="text-xs font-mono font-bold text-[#22355E] mt-0.5 break-all">
                  {e.enrollmentId || <span className="font-sans font-normal text-[#2B2B28]/50">Being issued</span>}
                </dd>
              </div>

              <div>
                <dt className="text-[10px] uppercase tracking-wider text-[#2B2B28]/50 flex items-center gap-1">
                  <Users className="w-3 h-3" /> Batch
                </dt>
                <dd className="text-xs font-bold text-[#22355E] mt-0.5">
                  {e.batchCode || (
                    <span className="font-normal text-[#8F6A15] inline-flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Being assigned
                    </span>
                  )}
                </dd>
              </div>

              <div>
                <dt className="text-[10px] uppercase tracking-wider text-[#2B2B28]/50 flex items-center gap-1">
                  <GraduationCap className="w-3 h-3" /> Teacher
                </dt>
                <dd className="text-xs font-bold text-[#22355E] mt-0.5 truncate">
                  {e.teacherName || <span className="font-normal text-[#2B2B28]/50">To be announced</span>}
                </dd>
              </div>

              <div>
                <dt className="text-[10px] uppercase tracking-wider text-[#2B2B28]/50">Status</dt>
                <dd className="mt-0.5">
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#5C7A5E]/15 text-[#5C7A5E] border border-[#5C7A5E]/25">
                    {e.status === 'active' ? 'Active' : e.status}
                  </span>
                </dd>
              </div>
            </dl>

            {e.enrolledAt && (
              <p className="text-[10px] text-[#2B2B28]/45 mt-3 pt-3 border-t border-[#DFDACB]">
                Enrolled on{' '}
                {new Date(e.enrolledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
