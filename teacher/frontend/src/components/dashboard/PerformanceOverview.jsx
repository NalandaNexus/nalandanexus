import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
} from 'recharts';
import { TrendingUp, Users, Lock } from 'lucide-react';
import { useTeacherAuth } from '../../context/TeacherAuthContext';
import { teacherApiService, ApiClientError } from '../../services/teacherApiService';
import ProBadge from '../common/ProBadge';

const OVERLAY_COLORS = ['#C1352B', '#C99A2E', '#5C7A5E', '#8B5CF6', '#2563EB'];

/**
 * Real cohort trend, sourced from GET /analytics/performance-trend — buckets
 * graded submission scores server-side (see analytics.service.js). There is
 * no historical snapshot table, so a bucket with zero graded work in range
 * is simply absent rather than filled with an invented value. Pro-gated on
 * the backend (requirePro), so a Standard-tier teacher sees an honest
 * upgrade prompt instead of a silently-empty or fabricated chart.
 */
export default function PerformanceOverview({ timeFilter, setTimeFilter, overlayCandidates = [] }) {
  const { user } = useTeacherAuth();
  const isPro = Boolean(user?.isPro);

  const [activeOverlays, setActiveOverlays] = useState(new Set());
  const [trend, setTrend] = useState({ points: [], students: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const toggleStudent = (id) => {
    setActiveOverlays((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fetchTrend = useCallback(async () => {
    if (!isPro) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await teacherApiService.getPerformanceTrend({
        range: timeFilter,
        studentIds: Array.from(activeOverlays),
      });
      setTrend({ points: data?.points || [], students: data?.students || [] });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load performance trend.');
    } finally {
      setIsLoading(false);
    }
  }, [isPro, timeFilter, activeOverlays]);

  useEffect(() => {
    fetchTrend();
  }, [fetchTrend]);

  const classMean = useMemo(() => {
    if (!trend.points.length) return null;
    const sum = trend.points.reduce((acc, p) => acc + (p.classAvg || 0), 0);
    return Math.round(sum / trend.points.length);
  }, [trend.points]);

  const candidateList = overlayCandidates.slice(0, 6);

  return (
    <section aria-labelledby="perf-overview-heading" className="p-5 sm:p-6 rounded-2xl bg-[#FFFFFF] border border-[#DFDACB] space-y-5">
      {/* Header & Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#22355E]" />
            <h3 id="perf-overview-heading" className="text-base sm:text-lg font-bold text-[#22355E] font-display">
              Cohort Performance Trajectory
            </h3>
            {!isPro && <ProBadge size="sm" />}
          </div>
          <p className="text-xs text-[#6E6A64] mt-0.5">
            Longitudinal trend line comparing class mean against individual overlay students.
          </p>
        </div>

        {isPro && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-[#F7F5EE] p-1 rounded-xl border border-[#DFDACB] text-xs">
              {[
                { id: 'thisWeek', label: 'This Week' },
                { id: 'thisMonth', label: 'This Month' },
                { id: 'thisTerm', label: 'This Term' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTimeFilter(t.id)}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    timeFilter === t.id
                      ? 'bg-[#22355E] text-white shadow-xs'
                      : 'text-[#6E6A64] hover:text-[#2B2B28]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {!isPro ? (
        <div className="h-72 w-full flex flex-col items-center justify-center gap-2 text-center bg-[#F7F5EE] rounded-xl border border-dashed border-[#DFDACB]">
          <Lock className="w-6 h-6 text-[#9B9690]" />
          <p className="text-sm font-bold text-[#22355E]">This feature requires a Pro faculty subscription.</p>
          <p className="text-xs text-[#6E6A64] max-w-sm">Upgrade to unlock longitudinal score trends and per-student overlay comparisons.</p>
        </div>
      ) : isLoading ? (
        <div className="h-72 w-full flex items-center justify-center text-xs text-[#9B9690]">Loading…</div>
      ) : error ? (
        <div className="h-72 w-full flex items-center justify-center text-xs text-[#C1352B]">{error}</div>
      ) : trend.points.length === 0 ? (
        <div className="h-72 w-full flex items-center justify-center text-xs text-[#9B9690] text-center px-6">
          Not enough graded work in this range yet — the trend line will populate as you grade submissions.
        </div>
      ) : (
        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend.points} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="classAvgGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22355E" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#22355E" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#DFDACB" vertical={false} />
              <XAxis dataKey="label" stroke="#6E6A64" fontSize={11} tickLine={false} />
              <YAxis stroke="#6E6A64" fontSize={11} domain={[0, 100]} tickLine={false} unit="%" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#22355E',
                  borderColor: '#16233F',
                  borderRadius: '12px',
                  color: '#EDEAE0',
                  fontSize: '12px',
                  boxShadow: '0 8px 24px -4px rgba(34, 53, 94, 0.25)',
                }}
              />
              <Area
                type="monotone"
                dataKey="classAvg"
                name="Class Average"
                stroke="#22355E"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#classAvgGrad)"
              />
              {trend.students.map((st, idx) => (
                <Line
                  key={st.id}
                  type="monotone"
                  dataKey={String(st.id)}
                  name={st.name}
                  stroke={OVERLAY_COLORS[idx % OVERLAY_COLORS.length]}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: OVERLAY_COLORS[idx % OVERLAY_COLORS.length] }}
                  connectNulls
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Interactive Legend & Student Overlay Toggles */}
      {isPro && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#DFDACB]/80">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-3 h-3 rounded-full bg-[#22355E] inline-block" />
            <span className="font-bold text-[#22355E]">Class Mean {classMean !== null ? `(${classMean}%)` : ''}</span>
          </div>

          {candidateList.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[#6E6A64] font-semibold flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> Toggle Overlays:
              </span>
              {candidateList.map((st, idx) => {
                const isSelected = activeOverlays.has(st.id);
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => toggleStudent(st.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#F7F5EE] border-[#22355E] text-[#22355E]'
                        : 'bg-[#FFFFFF] border-[#DFDACB] text-[#6E6A64] hover:text-[#2B2B28]'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: OVERLAY_COLORS[idx % OVERLAY_COLORS.length] }}
                    />
                    <span>{st.name} {st.className ? `(${st.className})` : ''}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
