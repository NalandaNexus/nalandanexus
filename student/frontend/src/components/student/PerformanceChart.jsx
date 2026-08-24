import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { useStudent } from '../../context/StudentContext';

// Custom Tooltip component for Recharts
function CustomChartTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#FAF9F4] border border-[#DFDACB] rounded-xl p-3 shadow-md text-xs font-body">
        <p className="font-heading font-bold text-[#22355E] mb-1.5">{label}</p>
        <div className="space-y-1">
          {payload.map((entry, index) => (
            <div key={`item-${index}`} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-[#2B2B28]/80 text-[11px]">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                {entry.name}:
              </span>
              <span className="font-data font-bold text-[#22355E]">
                {entry.value}%
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

export default function PerformanceChart() {
  const { student, performanceHistory } = useStudent();

  const avgQuiz = student?.performance?.averageQuiz ?? 0;
  const avgTask = student?.performance?.averageTask ?? 0;
  const streakDays = student?.streak?.current ?? 0;

  return (
    <section aria-labelledby="performance-heading">
      <div className="bg-[#FAF9F4] border border-[#DFDACB] rounded-2xl p-5 sm:p-6 shadow-xs">
        {/* Section Header */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#22355E]" />
            <h2
              id="performance-heading"
              className="font-display font-bold text-sm sm:text-base text-[#22355E] tracking-tight"
            >
              Your performance
            </h2>
          </div>
          <span className="text-[11px] font-semibold text-[#5C7A5E] bg-[#5C7A5E]/10 px-2 py-0.5 rounded-md">
            Consistency Trend
          </span>
        </div>

        {/* Exactly 3 Statistics Above Chart */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
          {/* Stat 1: Avg Quiz */}
          <div className="p-3 sm:p-4 rounded-xl bg-white border border-[#DFDACB] text-center shadow-2xs">
            <span className="text-[11px] sm:text-xs font-semibold text-[#2B2B28]/70 block">
              Avg Quiz
            </span>
            <span className="font-data font-bold text-xl sm:text-2xl text-[#22355E] tracking-tight mt-0.5 block">
              {avgQuiz}%
            </span>
          </div>

          {/* Stat 2: Avg Task */}
          <div className="p-3 sm:p-4 rounded-xl bg-white border border-[#DFDACB] text-center shadow-2xs">
            <span className="text-[11px] sm:text-xs font-semibold text-[#2B2B28]/70 block">
              Avg Task
            </span>
            <span className="font-data font-bold text-xl sm:text-2xl text-[#AB5236] tracking-tight mt-0.5 block">
              {avgTask}%
            </span>
          </div>

          {/* Stat 3: Streak */}
          <div className="p-3 sm:p-4 rounded-xl bg-white border border-[#DFDACB] text-center shadow-2xs">
            <span className="text-[11px] sm:text-xs font-semibold text-[#2B2B28]/70 block">
              Streak
            </span>
            <span className="font-data font-bold text-xl sm:text-2xl text-[#C99A2E] tracking-tight mt-0.5 block">
              {streakDays} days
            </span>
          </div>
        </div>

        {/* Responsive Recharts Line Chart */}
        <div className="w-full h-56 sm:h-64 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={performanceHistory}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#DFDACB"
                opacity={0.6}
                vertical={false}
              />
              <XAxis
                dataKey="day"
                stroke="#2B2B28"
                opacity={0.7}
                tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                tickLine={false}
                axisLine={{ stroke: '#DFDACB' }}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                stroke="#2B2B28"
                opacity={0.7}
                tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `${val}%`}
              />
              <Tooltip content={<CustomChartTooltip />} />
              <Legend
                verticalAlign="bottom"
                height={30}
                iconType="circle"
                wrapperStyle={{
                  fontSize: '11px',
                  fontFamily: 'Inter, sans-serif',
                  paddingTop: '8px',
                }}
              />
              <Line
                type="monotone"
                dataKey="quiz"
                name="Quiz Score"
                stroke="#22355E"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: '#22355E', strokeWidth: 1.5, stroke: '#FFFFFF' }}
                activeDot={{ r: 5, stroke: '#22355E', strokeWidth: 2, fill: '#FFFFFF' }}
              />
              <Line
                type="monotone"
                dataKey="task"
                name="Task Score"
                stroke="#AB5236"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: '#AB5236', strokeWidth: 1.5, stroke: '#FFFFFF' }}
                activeDot={{ r: 5, stroke: '#AB5236', strokeWidth: 2, fill: '#FFFFFF' }}
              />
              <Line
                type="monotone"
                dataKey="average"
                name="Class Average"
                stroke="#8C877B"
                strokeWidth={1.8}
                strokeDasharray="4 4"
                dot={false}
                activeDot={{ r: 4, fill: '#8C877B' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
