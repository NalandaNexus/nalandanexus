import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Activity } from 'lucide-react';

export default function RecentActivity({ activities = [] }) {
  const navigate = useNavigate();
  const items = activities;

  return (
    <div className="bg-white border border-[#DFDACB] rounded-2xl p-5 shadow-card space-y-4">
      {/* Header with View All Link */}
      <div className="flex items-center justify-between border-b border-[#EDEAE0] pb-3">
        <div>
          <h3 className="text-sm font-bold text-[#22355E]">Recent Platform Activity</h3>
          <p className="text-xs text-[#9B9690]">Verified administrative actions and system security events</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/logs')}
          className="text-xs font-semibold text-[#22355E] hover:text-[#AB5236] transition-colors flex items-center gap-1"
        >
          <span>View All</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Activity Timeline Items */}
      {items.length === 0 ? (
        <div className="py-8 text-center space-y-2">
          <Activity className="w-6 h-6 text-[#9B9690] mx-auto" />
          <p className="text-xs text-[#9B9690]">No recent activity yet — actions taken across the platform will appear here.</p>
        </div>
      ) : (
      <div className="space-y-3">
        {items.slice(0, 5).map((item, idx) => {
          const isGood = item.result === 'SUCCESS' || item.status === 'GOOD';
          const isAttention = item.status === 'ATTENTION' || item.category === 'TEACHER_MANAGEMENT';

          return (
            <div
              key={item.id || idx}
              className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-[#F7F5EE] transition-colors"
            >
              {/* Status-colored Icon Container */}
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  isGood
                    ? 'bg-[#5C7A5E]/15 text-[#5C7A5E] border border-[#5C7A5E]/30'
                    : isAttention
                    ? 'bg-[#C99A2E]/15 text-[#C99A2E] border border-[#C99A2E]/30'
                    : 'bg-[#C1352B]/15 text-[#C1352B] border border-[#C1352B]/30'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#2B2B28] leading-tight">
                  <strong className="font-semibold text-[#22355E]">{item.actor}</strong>{' '}
                  <span className="text-[#2B2B28]/90">{item.action}</span>
                </p>
                {item.target && (
                  <p className="text-[11px] font-mono text-[#9B9690] mt-0.5 truncate">{item.target}</p>
                )}
              </div>

              {/* Timestamp */}
              <span className="text-[10px] font-mono text-[#9B9690] flex-shrink-0 whitespace-nowrap">
                {item.timestamp}
              </span>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
