import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckSquare, Clock, CheckCircle2, ArrowRight, Award } from 'lucide-react';
import { useStudent } from '../../context/StudentContext';

export default function TasksListPage() {
  const { tasks } = useStudent();
  const [filter, setFilter] = useState('all'); // 'all' | 'pending' | 'completed'

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'pending') return !t.isCompleted;
    if (filter === 'completed') return t.isCompleted;
    return true;
  });

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
            Assignments, Reflections & Tasks
          </h1>
          <p className="text-xs text-[#2B2B28]/70 mt-0.5">
            Submit your weekly exercises and reflections to boost your overall performance score.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2">
          {['all', 'pending', 'completed'].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl capitalize transition-colors student-focus ${
                filter === f
                  ? 'bg-[#22355E] text-white font-bold'
                  : 'bg-[#FAF9F4] hover:bg-[#EDEAE0] border border-[#DFDACB] text-[#2B2B28]'
              }`}
            >
              {f} tasks ({tasks.filter((t) => (f === 'pending' ? !t.isCompleted : f === 'completed' ? t.isCompleted : true)).length})
            </button>
          ))}
        </div>

        {/* Tasks List */}
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className="p-5 rounded-2xl bg-[#FAF9F4] border border-[#DFDACB] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold font-data text-[#AB5236] uppercase bg-[#AB5236]/10 px-2 py-0.5 rounded">
                    {task.type}
                  </span>
                  <span className="text-xs font-semibold text-[#2B2B28]/60">
                    {task.moduleTitle || 'Parambh Foundation'}
                  </span>
                  {task.isCompleted && (
                    <span className="text-[10px] font-semibold text-[#5C7A5E] bg-[#5C7A5E]/15 px-2 py-0.5 rounded flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Completed
                    </span>
                  )}
                </div>

                <h3 className="font-heading font-bold text-base text-[#22355E]">
                  {task.title}
                </h3>

                <p className="text-xs text-[#2B2B28]/75 line-clamp-2 max-w-xl">
                  {task.description}
                </p>

                <div className="flex items-center gap-4 text-xs text-[#2B2B28]/70 font-data pt-1">
                  <span className="flex items-center gap-1 text-[#AB5236] font-semibold">
                    <Clock className="w-3.5 h-3.5" />
                    {task.dueDateLabel}
                  </span>
                  <span>·</span>
                  <span className="text-[#C99A2E] font-bold flex items-center gap-1">
                    <Award className="w-3.5 h-3.5" />
                    +{task.pointsReward} pts
                  </span>
                </div>
              </div>

              <Link
                to={task.targetUrl}
                className={`px-5 py-2.5 rounded-xl font-heading font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 shrink-0 min-h-[44px] ${
                  task.isCompleted
                    ? 'bg-white hover:bg-[#EDEAE0] border border-[#DFDACB] text-[#22355E]'
                    : 'bg-[#AB5236] hover:bg-[#92422a] text-white'
                }`}
              >
                <span>{task.isCompleted ? 'Review Submission' : 'Open Task'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
