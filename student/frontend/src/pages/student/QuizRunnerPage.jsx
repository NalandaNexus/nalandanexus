import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Timer,
} from 'lucide-react';
import { useStudent } from '../../context/StudentContext';
import { studentApiService } from '../../services/studentApiService';

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Quiz taking flow, backed entirely by the real API:
 *  - POST /student/quizzes/:quizId/start records the server-authoritative
 *    deadline (`expiresAt`) the moment the quiz is opened.
 *  - GET /student/quizzes/:quizId returns questions WITHOUT correct
 *    answers (the browser never receives them pre-submission).
 *  - POST /student/quizzes/:quizId/submit sends only the student's
 *    selected option indices; the backend grades the attempt and returns
 *    the score + explanations. The frontend never computes its own score.
 *    The on-screen countdown below is purely cosmetic - the backend
 *    rejects a submission past `expiresAt` regardless of what this timer
 *    shows (it's driven by that same server timestamp, not a local clock).
 */
export default function QuizRunnerPage() {
  const { quizId } = useParams();
  const { submitQuiz } = useStudent();

  const [quiz, setQuiz] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(true);
  const [expiresAt, setExpiresAt] = useState(null);
  const [remainingMs, setRemainingMs] = useState(null);
  const autoSubmitted = useRef(false);

  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [scoreResult, setScoreResult] = useState(null);

  const startAttempt = useCallback(async () => {
    autoSubmitted.current = false;
    const { expiresAt: newExpiresAt } = await studentApiService.startQuiz(quizId);
    setExpiresAt(newExpiresAt);
  }, [quizId]);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingQuiz(true);
    setLoadError('');
    Promise.all([studentApiService.getQuiz(quizId), startAttempt()])
      .then(([data]) => {
        if (!cancelled) setQuiz(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || 'This quiz is unavailable. You may need to purchase the course first.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingQuiz(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId]);

  const questions = quiz?.questions || [];

  const handleSelectOption = (questionId, optionIndex) => {
    if (isSubmitted) return;
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleSubmitQuiz = async (e) => {
    e?.preventDefault?.();
    if (isSubmitting || isSubmitted) return;

    setIsSubmitting(true);
    setSubmitError('');
    try {
      const result = await submitQuiz(quizId, selectedAnswers);
      setScoreResult(result);
      setIsSubmitted(true);
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#22355E', '#AB5236', '#C99A2E', '#5C7A5E'],
        });
      } catch {
        // confetti is purely decorative - ignore failures
      }
    } catch (err) {
      setSubmitError(err.message || 'Could not submit your quiz. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cosmetic countdown, ticked from the server's expiresAt - if it reaches
  // zero, attempt one auto-submit of whatever's answered so far; the
  // backend is the one that actually decides whether that lands in time.
  useEffect(() => {
    if (!expiresAt || isSubmitted) return undefined;
    const tick = () => {
      const remaining = new Date(expiresAt).getTime() - Date.now();
      setRemainingMs(remaining);
      if (remaining <= 0 && !autoSubmitted.current && !isSubmitted) {
        autoSubmitted.current = true;
        handleSubmitQuiz();
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt, isSubmitted]);

  const handleRetake = async () => {
    setSelectedAnswers({});
    setIsSubmitted(false);
    setScoreResult(null);
    setSubmitError('');
    try {
      await startAttempt();
    } catch (err) {
      setSubmitError(err.message || 'Could not start a new attempt. Please try again.');
    }
  };

  const isAllAnswered = Object.keys(selectedAnswers).length === questions.length && questions.length > 0;
  const isTimeUp = remainingMs !== null && remainingMs <= 0;

  // Once graded, the backend response includes the correct answer + explanation per question.
  const gradedById = new Map((scoreResult?.questions || []).map((q) => [q.questionId, q]));

  if (isLoadingQuiz) {
    return (
      <div className="w-full min-h-screen bg-[#EDEAE0] flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-[#22355E]/20 border-t-[#22355E] rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError || !quiz) {
    return (
      <div className="w-full min-h-screen bg-[#EDEAE0] flex items-center justify-center p-4">
        <div className="max-w-sm text-center space-y-3 bg-[#FAF9F4] border border-[#DFDACB] rounded-2xl p-6">
          <p className="font-heading font-bold text-[#22355E]">Unable to load this quiz</p>
          <p className="text-xs text-[#2B2B28]/70">{loadError}</p>
          <Link
            to="/student/dashboard"
            className="inline-block px-5 py-2.5 bg-[#22355E] text-white font-heading font-bold text-xs rounded-xl"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#EDEAE0] p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Top Breadcrumb */}
        <Link
          to="/student/dashboard"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#22355E] hover:text-[#AB5236] transition-colors p-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>

        {/* Quiz Container Card */}
        <div className="bg-[#FAF9F4] border border-[#DFDACB] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DFDACB] pb-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] font-bold font-data rounded bg-[#22355E] text-white uppercase">
                  Parambh Assessment
                </span>
                <span className="text-xs font-semibold text-[#2B2B28]/60">
                  {quiz.moduleTitle}
                </span>
              </div>
              <h1 className="font-display font-extrabold text-xl sm:text-2xl text-[#22355E] tracking-tight">
                {quiz.title}
              </h1>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!isSubmitted && remainingMs !== null && (
                <span
                  className={`inline-flex items-center gap-1 text-xs font-bold font-data px-3 py-1.5 rounded-lg border ${
                    remainingMs <= 60000
                      ? 'text-[#AB5236] bg-[#AB5236]/10 border-[#AB5236]/30 animate-pulse'
                      : 'text-[#22355E] bg-[#22355E]/10 border-[#22355E]/30'
                  }`}
                  title="Time is enforced by the server, not this on-screen clock"
                >
                  <Timer className="w-4 h-4" />
                  <span>{formatCountdown(remainingMs)}</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-xs font-semibold font-data text-[#C99A2E] bg-[#C99A2E]/10 px-3 py-1.5 rounded-lg border border-[#C99A2E]/30">
                <Award className="w-4 h-4 text-[#C99A2E]" />
                <span>+{quiz.pointsReward || 50} pts max</span>
              </span>
            </div>
          </div>

          {/* Results Display */}
          {isSubmitted && scoreResult && (
            <div className="p-6 rounded-xl bg-[#FAF5EA] border-2 border-[#5C7A5E] text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#5C7A5E] text-white flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="font-display font-bold text-xl text-[#22355E]">
                Quiz Score: {scoreResult.scorePercentage}%
              </h2>
              <p className="text-xs sm:text-sm text-[#2B2B28]/80 max-w-md mx-auto">
                You answered {scoreResult.correctCount} of {scoreResult.totalCount} questions correctly
                {scoreResult.pointsAwarded > 0 ? (
                  <>
                    {' '}and earned <strong className="text-[#AB5236]">+{scoreResult.pointsAwarded} points</strong>. Your dashboard metrics and streak have been updated!
                  </>
                ) : (
                  '. Points are only awarded on your first attempt of a quiz.'
                )}
              </p>
              <div className="pt-3 flex flex-wrap justify-center gap-3">
                <Link
                  to="/student/dashboard"
                  className="px-5 py-2.5 bg-[#22355E] hover:bg-[#1a2949] text-white font-heading font-bold text-xs rounded-xl shadow-xs transition-colors"
                >
                  Return to Dashboard
                </Link>
                <button
                  type="button"
                  onClick={handleRetake}
                  className="px-5 py-2.5 bg-white hover:bg-[#EDEAE0] border border-[#DFDACB] text-[#22355E] font-heading font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retake Quiz</span>
                </button>
              </div>
            </div>
          )}

          {submitError && (
            <p className="text-xs font-semibold text-[#AB5236] bg-[#AB5236]/10 border border-[#AB5236]/30 rounded-lg px-3 py-2">
              {submitError}
            </p>
          )}

          {/* Questions Form */}
          <form onSubmit={handleSubmitQuiz} className="space-y-6">
            {questions.map((q, qIndex) => {
              const selectedOpt = selectedAnswers[q.questionId];
              const graded = gradedById.get(q.questionId);
              return (
                <div
                  key={q.questionId}
                  className="p-4 sm:p-5 rounded-xl bg-white border border-[#DFDACB] shadow-2xs space-y-3"
                >
                  <div className="flex items-start gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#22355E] text-white flex items-center justify-center text-xs font-data font-bold shrink-0 mt-0.5">
                      {qIndex + 1}
                    </span>
                    <h3 className="font-heading font-bold text-sm text-[#22355E] leading-snug">
                      {q.question}
                    </h3>
                  </div>

                  {/* Options */}
                  <div className="space-y-2 pt-1 pl-8">
                    {q.options.map((option, optIdx) => {
                      const isSelected = selectedOpt === optIdx;
                      const isCorrect = isSubmitted && graded && optIdx === graded.correctIndex;
                      const isWrongSelected = isSubmitted && isSelected && graded && optIdx !== graded.correctIndex;

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => handleSelectOption(q.questionId, optIdx)}
                          disabled={isSubmitted || isTimeUp}
                          className={`w-full text-left p-3 rounded-xl text-xs font-medium transition-all flex items-center justify-between gap-3 min-h-[44px] student-focus ${
                            isCorrect
                              ? 'bg-[#5C7A5E]/15 border-2 border-[#5C7A5E] text-[#2B2B28] font-bold'
                              : isWrongSelected
                              ? 'bg-[#AB5236]/15 border-2 border-[#AB5236] text-[#AB5236]'
                              : isSelected
                              ? 'bg-[#22355E]/10 border-2 border-[#22355E] text-[#22355E] font-bold'
                              : 'bg-[#FAF9F4] hover:bg-[#EDEAE0] border border-[#DFDACB] text-[#2B2B28]'
                          }`}
                        >
                          <span>{option}</span>
                          {isSubmitted && isCorrect && (
                            <CheckCircle2 className="w-4 h-4 text-[#5C7A5E] shrink-0" />
                          )}
                          {isSubmitted && isWrongSelected && (
                            <XCircle className="w-4 h-4 text-[#AB5236] shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Explanation after submission (server-supplied) */}
                  {isSubmitted && graded?.explanation && (
                    <div className="mt-3 p-3 rounded-lg bg-[#FAF5EA] border border-[#DFDACB]/80 text-[11px] text-[#2B2B28]/80 ml-8">
                      <strong className="text-[#22355E]">Insight:</strong> {graded.explanation}
                    </div>
                  )}
                </div>
              );
            })}

            {!isSubmitted && (
              <div className="flex items-center justify-between gap-4 pt-2">
                <span className="text-xs text-[#2B2B28]/60 font-medium">
                  {isTimeUp ? 'Time is up — submitting…' : `${Object.keys(selectedAnswers).length} of ${questions.length} answered`}
                </span>

                <button
                  type="submit"
                  disabled={!isAllAnswered || isSubmitting || isTimeUp}
                  className="px-8 py-3 bg-[#AB5236] hover:bg-[#92422a] disabled:opacity-50 text-white font-heading font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 student-focus min-h-[44px]"
                >
                  {isSubmitting ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Submit Quiz (+{quiz.pointsReward || 50} pts)</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
