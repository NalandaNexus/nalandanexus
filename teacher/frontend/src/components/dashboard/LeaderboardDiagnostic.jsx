import React, { useState, useEffect } from 'react';
import { Award, ArrowUpDown, Filter, ArrowUpRight } from 'lucide-react';
import { useLiveLeaderboard } from '../../hooks/useLiveLeaderboard';

export default function LeaderboardDiagnostic({ classes = [], onSelectStudent }) {
  const [selectedClass, setSelectedClass] = useState(null);
  const [sortBy, setSortBy] = useState('score');
  const [filterBy, setFilterBy] = useState('all');

  useEffect(() => {
    if (!selectedClass && classes.length > 0) {
      setSelectedClass(classes[0].id);
    }
  }, [classes, selectedClass]);

  const { leaderboard, isLoading, error } = useLiveLeaderboard(selectedClass, {
    sortBy,
    filterBy,
  });

  return (
    <section aria-labelledby="diagnostic-leaderboard-heading" className="p-5 sm:p-6 rounded-2xl bg-[#FFFFFF] border border-[#DFDACB] space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-[#22355E]" />
            <h3 id="diagnostic-leaderboard-heading" className="text-base sm:text-lg font-bold text-[#22355E] font-display">
              Class-Scoped Diagnostic Leaderboard
            </h3>
          </div>
          <p className="text-xs text-[#6E6A64] mt-0.5">
            Diagnostic sorting across score trajectory, attendance reliability, and submission consistency.
          </p>
        </div>

        {/* Sorting & Filter Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs bg-[#F7F5EE] px-3 py-1.5 rounded-xl border border-[#DFDACB]">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#22355E]" />
            <span className="text-[#6E6A64] font-semibold">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-[#22355E] font-bold focus:outline-none cursor-pointer"
            >
              <option value="score">Score (High-Low)</option>
              <option value="improvement">Velocity / Improvement</option>
              <option value="attendance">Attendance Rate</option>
              <option value="submissions">On-Time Submissions</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs bg-[#F7F5EE] px-3 py-1.5 rounded-xl border border-[#DFDACB]">
            <Filter className="w-3.5 h-3.5 text-[#22355E]" />
            <span className="text-[#6E6A64] font-semibold">Filter:</span>
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value)}
              className="bg-transparent text-[#22355E] font-bold focus:outline-none cursor-pointer"
            >
              <option value="all">All Cohort</option>
              <option value="below75">Below 75% Score</option>
              <option value="lowAttendance">Low Attendance (&lt;80%)</option>
              <option value="missingTasks">Missing Submissions</option>
              <option value="declining">Declining Trend</option>
            </select>
          </div>
        </div>
      </div>

      {/* Class Selector Tabs */}
      {classes.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[#DFDACB]">
          {classes.map((cls) => (
            <button
              key={cls.id}
              onClick={() => setSelectedClass(cls.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                selectedClass === cls.id
                  ? 'bg-[#22355E] text-white shadow-xs'
                  : 'text-[#6E6A64] hover:text-[#2B2B28] hover:bg-[#F7F5EE]'
              }`}
            >
              {cls.name}
            </button>
          ))}
        </div>
      )}

      {/* Leaderboard Diagnostic Data Table */}
      <div className="overflow-x-auto rounded-xl border border-[#DFDACB]">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F7F5EE] text-[#22355E] border-b border-[#DFDACB]">
            <tr>
              <th className="py-3 px-4 font-bold uppercase tracking-wider">Rank</th>
              <th className="py-3 px-4 font-bold uppercase tracking-wider">Student</th>
              <th className="py-3 px-4 font-bold uppercase tracking-wider">Score</th>
              <th className="py-3 px-4 font-bold uppercase tracking-wider">Velocity</th>
              <th className="py-3 px-4 font-bold uppercase tracking-wider">Attendance</th>
              <th className="py-3 px-4 font-bold uppercase tracking-wider">Submissions</th>
              <th className="py-3 px-4 font-bold uppercase tracking-wider">Status</th>
              <th className="py-3 px-4 text-right font-bold uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DFDACB] bg-[#FFFFFF] text-[#2B2B28]">
            {classes.length === 0 ? (
              <tr><td colSpan={8} className="py-6 text-center text-[#9B9690]">No classes yet.</td></tr>
            ) : isLoading ? (
              <tr><td colSpan={8} className="py-6 text-center text-[#9B9690]">Loading…</td></tr>
            ) : error ? (
              <tr><td colSpan={8} className="py-6 text-center text-[#C1352B]">{error}</td></tr>
            ) : leaderboard.length === 0 ? (
              <tr><td colSpan={8} className="py-6 text-center text-[#9B9690]">No students match this view.</td></tr>
            ) : leaderboard.map((entry, idx) => (
              <tr
                key={entry.id}
                onClick={() => onSelectStudent(entry)}
                className="hover:bg-[#F7F5EE] cursor-pointer transition-colors"
              >
                <td className="py-3 px-4 font-mono font-bold text-[#6E6A64]">{idx + 1}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={entry.avatar}
                      alt=""
                      className="w-7 h-7 rounded-lg border border-[#DFDACB] bg-[#EDEAE0]"
                    />
                    <div>
                      <div className="font-bold text-[#22355E]">{entry.name}</div>
                      <div className="text-[10px] text-[#6E6A64]">{entry.email}</div>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 font-mono font-bold text-[#22355E] tabular-nums">
                  {entry.score}%
                </td>
                <td className="py-3 px-4 font-mono tabular-nums">
                  <span
                    className={`font-bold ${
                      entry.scoreChange >= 0 ? 'text-[#5C7A5E]' : 'text-[#C1352B]'
                    }`}
                  >
                    {entry.scoreChange >= 0 ? '+' : ''}
                    {entry.scoreChange}%
                  </span>
                </td>
                <td className="py-3 px-4 font-mono tabular-nums">
                  <span
                    className={
                      entry.attendanceRate < 75
                        ? 'text-[#C1352B] font-bold'
                        : 'text-[#2B2B28]'
                    }
                  >
                    {entry.attendanceRate}%
                  </span>
                </td>
                <td className="py-3 px-4 font-mono tabular-nums text-[#2B2B28]">
                  {entry.submissionRate}%
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      entry.riskLevel === 'act_now'
                        ? 'bg-[#C1352B]/15 text-[#C1352B] border border-[#C1352B]/30'
                        : entry.riskLevel === 'watch'
                        ? 'bg-[#C99A2E]/15 text-[#8F6A15] border border-[#C99A2E]/30'
                        : 'bg-[#5C7A5E]/15 text-[#5C7A5E] border border-[#5C7A5E]/30'
                    }`}
                  >
                    {entry.riskLevel === 'act_now'
                      ? 'Action'
                      : entry.riskLevel === 'watch'
                      ? 'Watch'
                      : 'Good'}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectStudent(entry);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#22355E] hover:bg-[#16233F] text-white text-[11px] font-bold transition-colors inline-flex items-center gap-1 shadow-xs"
                  >
                    Profile <ArrowUpRight className="w-3 h-3 text-[#C99A2E]" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
