import React, { useState } from 'react';
import { Trophy, Users, BookOpen, Award } from 'lucide-react';

export default function PerformanceLeaderboard({ leaderboardData }) {
  const [activeTab, setActiveTab] = useState('teachers'); // 'teachers' | 'courses'

  const currentList = leaderboardData?.[activeTab] || [];

  const getRankBadge = (rank) => {
    if (rank === 1) return <span className="text-sm">🥇</span>;
    if (rank === 2) return <span className="text-sm">🥈</span>;
    if (rank === 3) return <span className="text-sm">🥉</span>;
    return <span className="font-mono text-xs font-bold text-[#9B9690] w-4 text-center">{rank}</span>;
  };

  return (
    <div className="bg-white border border-[#DFDACB] rounded-2xl p-5 shadow-card space-y-4">
      {/* Header */}
      <div className="border-b border-[#EDEAE0] pb-3">
        <h3 className="text-sm font-bold text-[#22355E]">Performance & Leaderboard</h3>
        <p className="text-xs text-[#9B9690]">Institutional academic benchmarks and teaching quality index</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#EDEAE0] pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('teachers')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'teachers'
              ? 'bg-[#22355E] text-white shadow-sm'
              : 'text-[#9B9690] hover:text-[#22355E] hover:bg-[#EDEAE0]'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Top Teachers</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('courses')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'courses'
              ? 'bg-[#22355E] text-white shadow-sm'
              : 'text-[#9B9690] hover:text-[#22355E] hover:bg-[#EDEAE0]'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Top Courses</span>
        </button>
      </div>

      {/* Leaderboard Table / Rows */}
      {currentList.length === 0 ? (
        <p className="text-xs text-[#9B9690] text-center py-8">Not enough data yet to rank {activeTab}.</p>
      ) : (
      <div className="space-y-2">
        {currentList.map((item) => (
          <div
            key={item.rank}
            className="flex items-center justify-between p-3 rounded-xl bg-[#F7F5EE] border border-[#DFDACB]/80 hover:bg-[#F2EFE6] transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center justify-center w-6">{getRankBadge(item.rank)}</div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#22355E] truncate">{item.name}</p>
                <p className="text-[11px] text-[#9B9690] truncate">
                  {item.department || item.lead || item.code}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-shrink-0">
              <span className="hidden sm:inline-block text-[11px] text-[#9B9690]">
                {item.metric}
              </span>
              <div className="text-right">
                <span className="text-sm font-bold font-mono text-[#5C7A5E] bg-[#5C7A5E]/10 px-2 py-0.5 rounded-md border border-[#5C7A5E]/20">
                  {item.score}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
