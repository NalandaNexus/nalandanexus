import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Award, CheckCircle2, ArrowRight } from 'lucide-react';
import { studentApiService } from '../../services/studentApiService';
import { getSocket } from '../../services/socket';

export default function QuizzesListPage() {
  const [quizzes, setQuizzes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadQuizzes = useCallback(() => {
    return studentApiService
      .getQuizzes()
      .then((data) => setQuizzes(data))
      .catch((err) => setError(err.message || 'Unable to load quizzes.'));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    loadQuizzes().finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [loadQuizzes]);

  // Real-time: a teacher publishing a new quiz shows up without a manual reload.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;
    const handler = () => loadQuizzes();
    socket.on('course:quiz_created', handler);
    return () => socket.off('course:quiz_created', handler);
  }, [loadQuizzes]);

  return (
    <div className="w-full min-h-screen bg-[#EDEAE0] p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <Link
            to="/student/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#22355E] hover:text-[#AB5236] transition-colors mb-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-[#22355E]">
            Parambh Assessments & Quizzes
          </h1>
          <p className="text-xs text-[#2B2B28]/70 mt-0.5">
            Evaluate your knowledge retention and earn up to 50 points per completed assessment.
          </p>
        </div>

        {isLoading && <div className="p-8 text-center text-xs text-[#2B2B28]/60">Loading quizzes…</div>}

        {!isLoading && error && (
          <div className="p-8 text-center text-xs text-[#AB5236] bg-white border border-[#DFDACB] rounded-2xl">{error}</div>
        )}

        {!isLoading && !error && quizzes.length === 0 && (
          <div className="p-8 text-center text-xs text-[#2B2B28]/60 bg-white border border-[#DFDACB] rounded-2xl">
            No quizzes available yet for your enrolled course.
          </div>
        )}

        <div className="space-y-3">
          {quizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="p-5 rounded-2xl bg-[#FAF9F4] border border-[#DFDACB] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold font-data text-[#AB5236] uppercase bg-[#AB5236]/10 px-2 py-0.5 rounded">
                    {quiz.moduleTitle}
                  </span>
                  {quiz.attempted && (
                    <span className="text-[10px] font-semibold text-[#5C7A5E] bg-[#5C7A5E]/15 px-2 py-0.5 rounded flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Completed (Score: {quiz.lastScore}%)
                    </span>
                  )}
                </div>

                <h3 className="font-heading font-bold text-base text-[#22355E]">
                  {quiz.title}
                </h3>

                <div className="flex items-center gap-4 text-xs text-[#2B2B28]/70 font-data">
                  <span>{quiz.questionCount} questions</span>
                  <span>·</span>
                  <span className="text-[#C99A2E] font-bold flex items-center gap-1">
                    <Award className="w-3.5 h-3.5" />
                    +{quiz.pointsReward} pts
                  </span>
                </div>
              </div>

              <Link
                to={`/student/parambh/quizzes/${quiz.id}`}
                className="px-5 py-2.5 bg-[#22355E] hover:bg-[#1a2949] text-white font-heading font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 shrink-0 min-h-[44px]"
              >
                <span>{quiz.attempted ? 'Retake Quiz' : 'Start Quiz'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
