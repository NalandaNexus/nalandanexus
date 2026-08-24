import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

export default function TeacherStatusChart({ statusCounts }) {
  // By the time this renders, AdminOverviewPage has already resolved its
  // own loading/error states — a missing count here means genuinely zero,
  // not "still loading", so it's honest to show 0 rather than a
  // plausible-looking placeholder number.
  const activeCount = statusCounts?.active ?? 0;
  const invitedCount = statusCounts?.invited ?? 0;
  const suspendedCount = statusCounts?.suspended ?? 0;
  const inactiveCount = statusCounts?.inactive ?? 0;

  const total = activeCount + invitedCount + suspendedCount + inactiveCount;

  const chartData = [
    { name: 'Active', value: activeCount, color: '#5C7A5E', hex: '#5C7A5E', desc: 'Verified & Teaching' },
    { name: 'Invited', value: invitedCount, color: '#C99A2E', hex: '#C99A2E', desc: 'Awaiting Setup' },
    { name: 'Suspended', value: suspendedCount, color: '#C1352B', hex: '#C1352B', desc: 'Under Review' },
    { name: 'Inactive', value: inactiveCount, color: '#9B9690', hex: '#9B9690', desc: 'Archived Faculty' },
  ];

  return (
    <div className="bg-white border border-[#DFDACB] rounded-2xl p-5 shadow-card space-y-4">
      {/* Header */}
      <div className="border-b border-[#EDEAE0] pb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#22355E]">Faculty by Status</h3>
          <span className="text-xs font-mono font-bold text-[#22355E] bg-[#EDEAE0] px-2 py-0.5 rounded">
            Total: {total}
          </span>
        </div>
        <p className="text-xs text-[#9B9690]">Account authorization & lifecycle distribution</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
        {/* Donut Chart */}
        <div className="sm:col-span-5 h-48 relative flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={3}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="#FFFFFF" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const percent = total ? Math.round((data.value / total) * 100) : 0;
                    return (
                      <div className="bg-[#22355E] text-white p-2.5 rounded-xl shadow-xl text-xs font-sans border border-white/10">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
                          <strong className="text-white">{data.name}</strong>
                        </div>
                        <p className="font-mono text-[11px] text-[#EDEAE0]">
                          {data.value} teachers ({percent}%)
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Centered Total Count */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-bold font-mono text-[#22355E] leading-none">{total}</span>
            <span className="text-[10px] text-[#9B9690] uppercase tracking-wider font-semibold mt-1">Faculty</span>
          </div>
        </div>

        {/* Status Table & Legend (Never color alone!) */}
        <div className="sm:col-span-7 space-y-2">
          {chartData.map((item) => {
            const percent = total ? Math.round((item.value / total) * 100) : 0;
            return (
              <div
                key={item.name}
                className="flex items-center justify-between p-2 rounded-xl bg-[#F7F5EE] border border-[#DFDACB]/80 hover:bg-[#F2EFE6] transition-colors text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                  <div>
                    <span className="font-bold text-[#22355E]">{item.name}</span>
                    <span className="hidden lg:inline text-[10px] text-[#9B9690] ml-1.5 font-normal">
                      ({item.desc})
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 font-mono font-semibold">
                  <span className="text-[#22355E]">{item.value}</span>
                  <span className="text-[11px] text-[#9B9690] w-9 text-right">{percent}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
