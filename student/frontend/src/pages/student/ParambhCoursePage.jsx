import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Play, CheckCircle2, Lock, FileText, BrainCircuit, ArrowLeft, BookOpen } from 'lucide-react';
import { courseService } from '../../services/courseService';
import { useStudent } from '../../context/StudentContext';

const COURSE_SLUG = 'prarambh';

export default function ParambhCoursePage() {
  const { refreshData } = useStudent();

  const [courseContent, setCourseContent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeModuleId, setActiveModuleId] = useState(null);
  const [activeLessonId, setActiveLessonId] = useState(null);
  const [isMarking, setIsMarking] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await courseService.getEnrolledCourseContent(COURSE_SLUG);
      setCourseContent(data);
      const currentModule = data.modules.find((m) => m.lessons.some((l) => l.isCurrent)) || data.modules[0];
      const currentLesson = currentModule?.lessons.find((l) => l.isCurrent) || currentModule?.lessons[0];
      setActiveModuleId(currentModule?.moduleId || null);
      setActiveLessonId(currentLesson?.lessonId || null);
    } catch (err) {
      setError(err.message || 'You need to purchase this course before accessing its content.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const modules = courseContent?.modules || [];
  const activeModule = modules.find((m) => m.moduleId === activeModuleId) || modules[0];
  const activeLesson = activeModule?.lessons?.find((l) => l.lessonId === activeLessonId) || activeModule?.lessons?.[0];

  const handleMarkComplete = async () => {
    if (!activeLesson || activeLesson.completed) return;
    setIsMarking(true);
    try {
      await courseService.markLessonComplete(activeLesson.lessonId);
      await load();
      refreshData();
    } catch (err) {
      setError(err.message || 'Could not mark this lesson complete.');
    } finally {
      setIsMarking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full min-h-screen bg-[#EDEAE0] flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-[#22355E]/20 border-t-[#22355E] rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !courseContent) {
    return (
      <div className="w-full min-h-screen bg-[#EDEAE0] flex items-center justify-center p-4">
        <div className="max-w-sm text-center space-y-3 bg-[#FAF9F4] border border-[#DFDACB] rounded-2xl p-6">
          <p className="font-heading font-bold text-[#22355E]">Course content unavailable</p>
          <p className="text-xs text-[#2B2B28]/70">{error}</p>
          <Link to="/courses/prarambh" className="inline-block px-5 py-2.5 bg-[#AB5236] text-white font-heading font-bold text-xs rounded-xl">
            View Course & Purchase
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#EDEAE0] p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Breadcrumb & Return to Dashboard */}
        <div className="flex items-center justify-between">
          <Link
            to="/student/dashboard"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#22355E] hover:text-[#AB5236] transition-colors p-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Student Dashboard</span>
          </Link>

          <span className="text-xs font-semibold font-data text-[#5C7A5E] bg-[#5C7A5E]/10 px-2.5 py-1 rounded-md">
            Progress: {courseContent.progress}%
          </span>
        </div>

        {/* Hero Course Banner & Info */}
        <div className="bg-[#FAF9F4] border border-[#DFDACB] rounded-2xl p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] font-bold font-data rounded bg-[#AB5236] text-white uppercase">
                  Foundation Course
                </span>
                <span className="text-xs font-serif italic text-[#C99A2E]">
                  || विद्या ददाति विनयं ||
                </span>
              </div>
              <h1 className="font-display font-extrabold text-xl sm:text-2xl lg:text-3xl text-[#22355E] tracking-tight">
                {courseContent.title}
              </h1>
              <p className="text-xs sm:text-sm text-[#2B2B28]/80 max-w-2xl">
                {courseContent.subtitle}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                to="/student/parambh/quizzes/mindset"
                className="px-4 py-2 bg-[#22355E] hover:bg-[#1a2949] text-white font-heading font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 min-h-[44px]"
              >
                <BrainCircuit className="w-4 h-4 text-[#C99A2E]" />
                <span>Take Mindset Quiz</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Split Learning Environment: Video Player (Left) + Module Syllabus (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: Video Player & Lesson Content (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-black rounded-2xl overflow-hidden shadow-lg aspect-video relative border border-[#DFDACB] flex items-center justify-center">
              <video
                key={activeLesson?.lessonId}
                src={activeLesson?.videoUrl || courseContent.videoUrl}
                poster={courseContent.bannerImage}
                controls
                className="w-full h-full object-cover"
              >
                Your browser does not support the video tag.
              </video>
            </div>

            {/* Current Lesson Metadata Card */}
            <div className="bg-[#FAF9F4] border border-[#DFDACB] rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#AB5236] uppercase tracking-wider font-data">
                  {activeModule?.title}
                </span>
                <span className="text-xs font-data text-[#2B2B28]/60">
                  Duration: {activeLesson?.duration || '—'}
                </span>
              </div>

              <h2 className="font-heading font-bold text-base sm:text-lg text-[#22355E]">
                {activeLesson?.title}
              </h2>

              <div className="pt-3 border-t border-[#DFDACB] flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleMarkComplete}
                  disabled={isMarking || activeLesson?.completed}
                  className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors min-h-[40px] ${
                    activeLesson?.completed
                      ? 'bg-[#5C7A5E]/15 text-[#5C7A5E] cursor-default'
                      : 'bg-[#AB5236] hover:bg-[#92422a] text-white'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{activeLesson?.completed ? 'Lesson Completed' : isMarking ? 'Saving…' : 'Mark Lesson Complete (+10 XP)'}</span>
                </button>

                <Link
                  to="/student/parambh/tasks/orientation-reflection"
                  className="px-3 py-1.5 bg-[#F2EFE6] hover:bg-[#EDEAE0] border border-[#DFDACB] text-[#22355E] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-[#AB5236]" />
                  <span>Open Task: Orientation Reflection</span>
                </Link>

                <Link
                  to="/student/notes"
                  className="px-3 py-1.5 bg-[#F2EFE6] hover:bg-[#EDEAE0] border border-[#DFDACB] text-[#22355E] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[#22355E]" />
                  <span>Take Notes</span>
                </Link>
              </div>
            </div>
          </div>

          {/* RIGHT: Module & Lesson Syllabus Accordion (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            <h3 className="font-heading font-bold text-sm text-[#22355E] px-1">
              Course Modules Syllabus
            </h3>

            <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
              {modules.map((mod) => {
                const isActiveModule = mod.moduleId === activeModuleId;
                return (
                  <div
                    key={mod.moduleId}
                    className="bg-[#FAF9F4] border border-[#DFDACB] rounded-2xl overflow-hidden shadow-2xs"
                  >
                    <button
                      type="button"
                      onClick={() => setActiveModuleId(mod.moduleId)}
                      className="w-full flex items-center justify-between p-3.5 text-left bg-[#F2EFE6] hover:bg-[#EDEAE0] transition-colors border-b border-[#DFDACB]/60 student-focus"
                    >
                      <span className="font-heading font-bold text-xs text-[#22355E] truncate">
                        {mod.title}
                      </span>
                      <span className="text-[10px] font-data text-[#2B2B28]/60 shrink-0">
                        {mod.lessons.length} lessons
                      </span>
                    </button>

                    {isActiveModule && (
                      <div className="p-2 space-y-1 divide-y divide-[#DFDACB]/40">
                        {mod.lessons.map((lesson) => {
                          const isCurrent = lesson.lessonId === activeLessonId;
                          return (
                            <button
                              key={lesson.lessonId}
                              type="button"
                              onClick={() => {
                                if (!lesson.isLocked) setActiveLessonId(lesson.lessonId);
                              }}
                              disabled={lesson.isLocked}
                              className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all min-h-[44px] student-focus ${
                                isCurrent
                                  ? 'bg-[#22355E] text-white shadow-xs'
                                  : lesson.isLocked
                                  ? 'opacity-50 cursor-not-allowed bg-transparent text-[#2B2B28]/50'
                                  : 'hover:bg-[#EDEAE0] text-[#2B2B28]'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                {lesson.completed ? (
                                  <CheckCircle2 className={`w-4 h-4 shrink-0 ${isCurrent ? 'text-[#C99A2E]' : 'text-[#5C7A5E]'}`} />
                                ) : lesson.isLocked ? (
                                  <Lock className="w-3.5 h-3.5 shrink-0 text-[#2B2B28]/40" />
                                ) : (
                                  <Play className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? 'text-[#C99A2E] fill-[#C99A2E]' : 'text-[#AB5236]'}`} />
                                )}
                                <span className="text-xs font-medium truncate">{lesson.title}</span>
                              </div>
                              <span className={`text-[10px] font-data shrink-0 ${isCurrent ? 'text-white/80' : 'text-[#2B2B28]/60'}`}>
                                {lesson.duration}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
