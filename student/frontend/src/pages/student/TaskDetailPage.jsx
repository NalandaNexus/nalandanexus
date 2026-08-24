import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Award,
  Send,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { useStudent } from '../../context/StudentContext';

export default function TaskDetailPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { tasks, completeTask, isLoadingDashboard } = useStudent();

  // Find task matching param - never silently substitutes an unrelated
  // task for a stale/invalid taskId (that would let a student read, and
  // potentially submit against, the wrong assignment).
  const task = tasks.find((t) => t.id === taskId);
  const notFound = !isLoadingDashboard && tasks.length > 0 && !task;

  const [submissionText, setSubmissionText] = useState(task?.submissionText || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(task?.isCompleted || false);
  const [submitError, setSubmitError] = useState('');

  // The task list can still be loading on first render (task is undefined
  // then), so these can't rely on the useState initializer alone - sync
  // once the real task data actually arrives.
  useEffect(() => {
    if (task) {
      setSubmissionText(task.submissionText || '');
      setIsSubmitted(task.isCompleted || false);
    }
  }, [task]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!submissionText.trim() || !task) return;

    setIsSubmitting(true);
    setSubmitError('');
    try {
      await completeTask(task.id, submissionText);
      setIsSubmitted(true);
    } catch (err) {
      setSubmitError(err.message || 'Could not submit your task. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingDashboard && !task) {
    return (
      <div className="w-full min-h-screen bg-[#EDEAE0] flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-[#22355E]/20 border-t-[#22355E] rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="w-full min-h-screen bg-[#EDEAE0] flex items-center justify-center p-4">
        <div className="max-w-sm text-center space-y-3 bg-[#FAF9F4] border border-[#DFDACB] rounded-2xl p-6">
          <p className="font-heading font-bold text-[#22355E]">Task not found</p>
          <p className="text-xs text-[#2B2B28]/70">This assignment doesn't exist or is no longer available.</p>
          <Link to="/student/dashboard" className="inline-block px-5 py-2.5 bg-[#AB5236] text-white font-heading font-bold text-xs rounded-xl">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#EDEAE0] p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <Link
          to="/student/dashboard"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#22355E] hover:text-[#AB5236] transition-colors p-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>

        {/* Main Task Container */}
        <div className="bg-[#FAF9F4] border border-[#DFDACB] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          {/* Task Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DFDACB] pb-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] font-bold font-data rounded bg-[#AB5236] text-white uppercase">
                  {task?.type || 'Task'}
                </span>
                <span className="text-xs font-semibold text-[#2B2B28]/60">
                  {task?.moduleTitle || 'Parambh Foundation'}
                </span>
              </div>
              <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#22355E] tracking-tight">
                {task?.title || 'Assignment Details'}
              </h1>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-1 text-xs font-semibold font-data text-[#C99A2E] bg-[#C99A2E]/10 px-3 py-1.5 rounded-lg border border-[#C99A2E]/30">
                <Award className="w-4 h-4 text-[#C99A2E]" />
                <span>+{task?.pointsReward || 30} pts</span>
              </span>
            </div>
          </div>

          {/* Task Prompt / Description */}
          <div className="p-4 rounded-xl bg-[#F2EFE6] border border-[#DFDACB] space-y-2">
            <h2 className="font-heading font-bold text-xs text-[#22355E] uppercase tracking-wider">
              Task Prompt & Objectives
            </h2>
            <p className="text-xs sm:text-sm text-[#2B2B28]/85 leading-relaxed">
              {task?.description ||
                'Please write your structured thoughts and actionable roadmap below. Outline your core communication strengths, challenges, and growth goals for the upcoming semester.'}
            </p>
          </div>

          {/* Submission State or Form */}
          {isSubmitted ? (
            /* Completed Banner */
            <div className="p-6 rounded-xl bg-[#FAF5EA] border-2 border-[#5C7A5E] text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#5C7A5E] text-white flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-lg text-[#22355E]">
                Task Successfully Completed!
              </h3>
              <p className="text-xs sm:text-sm text-[#2B2B28]/80 max-w-md mx-auto">
                Your submission has been recorded. +{task?.pointsReward || 30} points have been added to your profile, and your performance metrics have been updated live.
              </p>
              <div className="pt-2 flex justify-center gap-3">
                <Link
                  to="/student/dashboard"
                  className="px-6 py-2.5 bg-[#22355E] hover:bg-[#1a2949] text-white font-heading font-bold text-xs rounded-xl shadow-xs transition-colors"
                >
                  Return to Dashboard
                </Link>
                <Link
                  to="/student/parambh"
                  className="px-6 py-2.5 bg-[#AB5236] hover:bg-[#92422a] text-white font-heading font-bold text-xs rounded-xl shadow-xs transition-colors"
                >
                  Next Lesson
                </Link>
              </div>
            </div>
          ) : (
            /* Input Submission Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="submissionInput"
                  className="block text-xs font-heading font-bold text-[#22355E] mb-1.5"
                >
                  Your Submission & Reflection
                </label>
                <textarea
                  id="submissionInput"
                  rows={6}
                  value={submissionText}
                  onChange={(e) => setSubmissionText(e.target.value)}
                  placeholder="Write your detailed reflections, insights, or action points here..."
                  required
                  className="w-full p-3.5 bg-white border border-[#DFDACB] rounded-xl text-xs sm:text-sm text-[#2B2B28] placeholder-[#2B2B28]/40 focus:outline-none focus:ring-2 focus:ring-[#22355E] focus:border-[#22355E] transition-all"
                />
              </div>

              {submitError && (
                <p className="text-xs font-semibold text-[#AB5236] bg-[#AB5236]/10 border border-[#AB5236]/30 rounded-lg px-3 py-2">
                  {submitError}
                </p>
              )}

              <div className="flex items-center justify-between gap-4 pt-2">
                <span className="text-[11px] text-[#2B2B28]/60 font-medium">
                  {submissionText.length} characters entered
                </span>

                <button
                  type="submit"
                  disabled={isSubmitting || !submissionText.trim()}
                  className="px-6 py-3 bg-[#AB5236] hover:bg-[#92422a] disabled:opacity-50 text-white font-heading font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 student-focus min-h-[44px]"
                >
                  {isSubmitting ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit Task (+{task?.pointsReward || 30} pts)</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
