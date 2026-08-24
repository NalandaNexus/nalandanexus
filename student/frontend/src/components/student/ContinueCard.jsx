import React from 'react';
import { Link } from 'react-router-dom';
import { Play, Sparkles, BookOpen, Clock } from 'lucide-react';
import { useStudent } from '../../context/StudentContext';

export default function ContinueCard() {
  const { student, course } = useStudent();

  const progress = student?.course?.progress ?? 0;
  const courseTitle = student?.course?.name?.toUpperCase() || '';
  const subtitle = student?.course?.subtitle || '';
  const currentLessonTitle = student?.course?.currentLessonTitle || 'Start your first lesson';

  return (
    <section aria-labelledby="continue-card-heading">
      <div className="bg-[#FAF9F4] border border-[#DFDACB] rounded-2xl p-5 sm:p-6 shadow-xs relative overflow-hidden">
        {/* Subtle Decorative Accent */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-[#AB5236]/5 rounded-bl-full pointer-events-none" />

        {/* Section Header */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#AB5236]" />
            <h2
              id="continue-card-heading"
              className="font-display font-bold text-sm sm:text-base text-[#22355E] tracking-tight"
            >
              Continue where you left off
            </h2>
          </div>
          <span className="text-[11px] font-semibold text-[#5C7A5E] bg-[#5C7A5E]/10 px-2 py-0.5 rounded-md">
            Active Course
          </span>
        </div>

        {/* Main Content Layout */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 pt-1">
          {/* Left Course & Lesson Information */}
          <div className="space-y-2 max-w-xl">
            <div>
              <span className="text-[11px] font-bold font-data text-[#AB5236] tracking-wider uppercase">
                {courseTitle}
              </span>
              <h3 className="font-heading font-extrabold text-base sm:text-lg text-[#22355E] tracking-tight">
                {subtitle}
              </h3>
            </div>

            {/* Current Lesson snippet */}
            <div className="flex items-center gap-2 text-xs text-[#2B2B28]/80 bg-[#F2EFE6] px-3 py-1.5 rounded-xl border border-[#DFDACB]/60 w-fit">
              <BookOpen className="w-3.5 h-3.5 text-[#22355E] shrink-0" />
              <span className="font-medium truncate max-w-xs sm:max-w-md">
                Next: <strong className="text-[#22355E]">{currentLessonTitle}</strong>
              </span>
            </div>

            {/* Progress Information & Bar */}
            <div className="pt-1 space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-data font-bold text-[#22355E]">
                  {progress}% of Parambh done
                </span>
                <span className="font-data text-[#2B2B28]/60 text-[11px]">
                  {student?.topicsCompleted ?? 0} of {student?.totalTopics ?? 0} topics completed
                </span>
              </div>

              {/* Progress Bar Container */}
              <div
                className="w-full h-2.5 bg-[#EDEAE0] rounded-full overflow-hidden border border-[#DFDACB]"
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin="0"
                aria-valuemax="100"
                aria-label={`Parambh course progress: ${progress}%`}
              >
                <div
                  className="h-full bg-gradient-to-r from-[#AB5236] to-[#C99A2E] rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Right Action Button */}
          <div className="shrink-0 flex items-center">
            <Link
              to="/student/parambh"
              className="w-full sm:w-auto px-6 py-3.5 bg-[#AB5236] hover:bg-[#92422a] text-white font-heading font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2.5 group student-focus min-h-[44px]"
            >
              <Play className="w-4 h-4 fill-white group-hover:scale-110 transition-transform" />
              <span>Resume lesson</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
