import React, { useState, useEffect } from 'react';
import { Shield, Search, FileDown, Lock, CheckCircle2 } from 'lucide-react';
import EmptyState from '../components/common/EmptyState';
import { adminApi } from '../services/adminApi';
import { useRealtimeEvents } from '../hooks/useRealtimeEvents';

const ENTITY_TYPES = ['Teacher', 'Student', 'Course', 'Announcement', 'Payment', 'Enrollment', 'Settings', 'Admin', 'Report'];

export default function SystemLogsPage() {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const fetchLogs = () => {
    adminApi.getAuditLogs({ limit: 200 }).then((data) => {
      setLogs(data);
      setIsLoading(false);
    });
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  useRealtimeEvents(['audit.created'], fetchLogs);

  const filteredLogs = logs.filter((l) => {
    const matchesSearch =
      l.actorName?.toLowerCase().includes(search.toLowerCase()) ||
      l.action?.toLowerCase().includes(search.toLowerCase()) ||
      l.entityType?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || l.entityType === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await adminApi.downloadReport('audit');
    } catch (err) {
      // Export failures are non-critical to the page — surfaced inline instead of a toast system here.
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#DFDACB]/80 pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#22355E]/10 text-[#22355E] text-[11px] font-bold mb-1">
            <Lock className="w-3 h-3" /> Append-Only Immutable Security Ledger
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#22355E]">System Audit Trail & Governance Logs</h1>
          <p className="text-xs text-[#9B9690] mt-0.5">
            Log trail recording all administrator interventions, account lifecycle events, and permission authorizations.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting}
          className="px-3.5 py-2 rounded-xl bg-white border border-[#DFDACB] hover:bg-[#EDEAE0] text-xs font-semibold text-[#22355E] transition-colors flex items-center gap-1.5 shadow-sm self-start sm:self-auto disabled:opacity-60"
        >
          <FileDown className="w-3.5 h-3.5" />
          <span>{isExporting ? 'Preparing...' : 'Export Audit Log'}</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-[#DFDACB] rounded-2xl p-4 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9B9690]" />
          <input
            type="text"
            placeholder="Search audit trail by actor, action, or entity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl pl-10 pr-4 py-2 text-xs text-[#2B2B28] placeholder-[#9B9690] focus:outline-none focus:border-[#22355E]"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3 py-2 text-xs font-semibold text-[#22355E] focus:outline-none"
        >
          <option value="ALL">All Entity Types</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-[#DFDACB] rounded-2xl shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-[#9B9690]">Loading audit records...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8">
            <EmptyState title="No audit records found" description="No actions match your current search or filter." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F5EE] border-b border-[#DFDACB] text-[#9B9690] font-semibold">
                <tr>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action Performed</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4 font-mono">Timestamp</th>
                  <th className="py-3 px-4 text-right">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDEAE0] text-[#2B2B28]">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#F7F5EE]/60 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-[#22355E]">{log.actorName || 'System'}</td>
                    <td className="py-3.5 px-4 font-semibold text-[#2B2B28]">{log.action.replace(/\./g, ' ').replace(/_/g, ' ')}</td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-[#9B9690] max-w-xs truncate">
                      {log.entityType}{log.entityId ? ` #${String(log.entityId).slice(-6)}` : ''}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-[#9B9690]">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="py-3.5 px-4 text-right">
                      <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${
                          log.result === 'SUCCESS'
                            ? 'bg-[#5C7A5E]/15 text-[#5C7A5E] border-[#5C7A5E]/30'
                            : 'bg-[#C1352B]/15 text-[#C1352B] border-[#C1352B]/30'
                        }`}
                      >
                        {log.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="p-4 bg-[#F7F5EE] border-t border-[#DFDACB] text-xs text-[#9B9690] flex justify-between">
          <span>Read-Only Audit Log</span>
          <span className="font-mono font-bold text-[#22355E]">{filteredLogs.length} Entries</span>
        </div>
      </div>
    </div>
  );
}
