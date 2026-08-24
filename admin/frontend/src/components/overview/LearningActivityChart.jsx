import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

export default function LearningActivityChart({ dataByRange }) {
  const [selectedRange, setSelectedRange] = useState('7d');

  const chartData = dataByRange?.[selectedRange] || [];
  const hasData = chartData.some((d) => d.activeSessions > 0 || d.submissions > 0);

  const RANGES = [
    { id: '7d', label: '7 Days' },
    { id: '30d', label: '30 Days' },
    { id: '3m', label: '3 Months' },
    { id: '1y', label: '1 Year' },
  ];

  return (
    <div className="bg-white border border-[#DFDACB] rounded-2xl p-5 shadow-card space-y-4">
      {/* Header & Functional Range Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#EDEAE0] pb-3">
        <div>
          <h3 className="text-sm font-bold text-[#22355E]">Learning Activity</h3>
          <p className="text-xs text-[#9B9690]">Platform student engagement and concurrent learning sessions</p>
        </div>

        {/* Range Buttons */}
        <div className="flex items-center gap-1 bg-[#EDEAE0] p-1 rounded-xl self-start sm:self-auto border border-[#DFDACB]">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedRange(r.id)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                selectedRange === r.id
                  ? 'bg-white text-[#22355E] shadow-sm font-bold'
                  : 'text-[#9B9690] hover:text-[#22355E]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Recharts Area Chart */}
      {!hasData ? (
        <div className="h-72 w-full flex items-center justify-center text-xs text-[#9B9690]">
          No learning activity recorded for this period yet.
        </div>
      ) : (
      <div className="h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22355E" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#22355E" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorSubmissions" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#5C7A5E" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#5C7A5E" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EDEAE0" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#9B9690', fontFamily: 'Inter' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#9B9690', fontFamily: 'IBM Plex Mono' }}
              label={{
                value: 'Active Sessions',
                angle: -90,
                position: 'insideLeft',
                offset: 25,
                style: { textAnchor: 'middle', fill: '#9B9690', fontSize: 11, fontFamily: 'Inter' },
              }}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-[#22355E] text-white p-3 rounded-xl shadow-xl text-xs font-sans border border-white/10 space-y-1">
                      <p className="font-bold text-[#EDEAE0] mb-1.5 border-b border-white/10 pb-1">{label}</p>
                      <p className="font-mono text-[11px] text-[#EDEAE0] flex justify-between gap-4">
                        <span>Active Sessions:</span>
                        <strong className="text-white">{payload[0]?.value?.toLocaleString()}</strong>
                      </p>
                      {payload[1] && (
                        <p className="font-mono text-[11px] text-[#EDEAE0] flex justify-between gap-4">
                          <span>Submissions:</span>
                          <strong className="text-[#5C7A5E]">{payload[1]?.value?.toLocaleString()}</strong>
                        </p>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="activeSessions"
              name="Active Sessions"
              stroke="#22355E"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorSessions)"
            />
            <Area
              type="monotone"
              dataKey="submissions"
              name="Assignment Submissions"
              stroke="#5C7A5E"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorSubmissions)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      )}

      {/* Legend Footer */}
      <div className="flex items-center justify-center gap-6 pt-2 text-xs text-[#9B9690]">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#22355E]" />
          <span>Active Learning Sessions (Unit)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#5C7A5E]" />
          <span>Completed Submissions</span>
        </div>
      </div>
    </div>
  );
}
