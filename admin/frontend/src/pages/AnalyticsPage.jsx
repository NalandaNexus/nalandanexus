import React, { useState, useEffect, useCallback } from 'react';
import { Activity } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { adminApi } from '../services/adminApi';

const STATUS_STYLES = {
  HEALTHY: { bg: 'bg-[#5C7A5E]/15', text: 'text-[#5C7A5E]', border: 'border-[#5C7A5E]/30' },
  DEGRADED: { bg: 'bg-[#C99A2E]/15', text: 'text-[#C99A2E]', border: 'border-[#C99A2E]/30' },
  UNREACHABLE: { bg: 'bg-[#C1352B]/15', text: 'text-[#C1352B]', border: 'border-[#C1352B]/30' },
};

export default function AnalyticsPage() {
  const { liveData, telemetryStatus } = useOutletContext() || {};
  const [nodes, setNodes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHealth = useCallback(async () => {
    try {
      setError(null);
      const data = await adminApi.getSystemHealth();
      setNodes(data);
    } catch (err) {
      setError(err.message || 'Failed to load system health');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    // Real health checks (including live pings to the sibling student/teacher
    // backends) refresh every 15s — this is a genuine network call, not a
    // cosmetic timer, so it's kept infrequent.
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const allHealthy = nodes.length > 0 && nodes.every((n) => n.status === 'HEALTHY');

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#DFDACB]/80 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#22355E]">Platform Telemetry & Infrastructure</h1>
          <p className="text-xs text-[#9B9690] mt-1">
            Live status of this Admin API's own MongoDB connection, Socket.IO layer, and the sibling Student/Teacher
            portal services (checked via their real <code>/api/health</code> endpoints).
          </p>
        </div>
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold font-mono border ${
            allHealthy
              ? 'bg-[#5C7A5E]/15 text-[#5C7A5E] border-[#5C7A5E]/30'
              : 'bg-[#C99A2E]/15 text-[#C99A2E] border-[#C99A2E]/30'
          }`}
        >
          <span className={`w-2 h-2 rounded-full animate-pulse ${allHealthy ? 'bg-[#5C7A5E]' : 'bg-[#C99A2E]'}`} />
          <span>{allHealthy ? 'All Checked Services Healthy' : 'Some Services Need Attention'}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-xs text-[#9B9690] space-y-2">
          <div className="w-6 h-6 border-2 border-[#22355E] border-t-transparent rounded-full animate-spin mx-auto" />
          <p>Running live health checks...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-white border border-[#C1352B]/30 rounded-2xl text-xs text-[#C1352B]">{error}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {nodes.map((node, i) => {
            const style = STATUS_STYLES[node.status] || STATUS_STYLES.UNREACHABLE;
            return (
              <div key={i} className="bg-white border border-[#DFDACB] rounded-2xl p-5 shadow-card space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#22355E] truncate">{node.name}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap ${style.bg} ${style.text} ${style.border}`}>
                    {node.status}
                  </span>
                </div>
                <div className="pt-2 border-t border-[#EDEAE0] text-xs">
                  <span className="text-[#9B9690] text-[10px] uppercase block">Detail</span>
                  <p className="font-mono font-bold text-[#22355E]">{node.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {liveData && (
        <div className="bg-white border border-[#DFDACB] rounded-2xl p-5 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-[#22355E]" />
            <h3 className="text-sm font-bold text-[#22355E]">Live Aggregate Counts (SSE — {telemetryStatus})</h3>
          </div>
          <pre className="text-[11px] font-mono text-[#2B2B28] bg-[#F7F5EE] p-3 rounded-xl overflow-x-auto">
            {JSON.stringify(liveData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
