import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import LiveClassPanel from '../components/dashboard/LiveClassPanel';
import { teacherApiService, ApiClientError } from '../services/teacherApiService';
import { socketService } from '../services/socketService';

export default function LiveSchedulePage() {
  const navigate = useNavigate();
  const [liveState, setLiveState] = useState({ isActive: false });
  const [schedule, setSchedule] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      setError(null);
      const [live, sched] = await Promise.all([teacherApiService.getLiveSession(), teacherApiService.getSchedule()]);
      setLiveState(live || { isActive: false });
      setSchedule(sched || []);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load live schedule.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    socketService.connect();
    const unbinds = ['class.started', 'class.completed', 'class.rescheduled', 'class.cancelled', 'class.updated'].map((ev) => socketService.on(ev, fetchAll));
    return () => unbinds.forEach((u) => u());
  }, [fetchAll]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#22355E] font-display">Live Teaching Studio & Timetable</h1>
          <p className="text-xs text-[#6E6A64] mt-1">Real-time studio monitoring and today's scheduled sessions.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/calendar')}
          className="flex items-center gap-2 bg-[#AB5236] hover:bg-[#94452C] text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-cta"
        >
          <Plus className="w-4 h-4" /> Schedule New Session
        </button>
      </div>

      {error && <div className="p-3.5 rounded-xl bg-[#C1352B]/10 border border-[#C1352B]/30 text-[#C1352B] text-xs">{error}</div>}

      <LiveClassPanel liveState={liveState} />

      <div className="p-6 rounded-2xl bg-[#FFFFFF] border border-[#DFDACB] space-y-4">
        <h3 className="text-sm font-bold text-[#22355E]">Today's Sessions</h3>
        {isLoading ? (
          <p className="text-xs text-[#9B9690]">Loading…</p>
        ) : schedule.length === 0 ? (
          <p className="text-xs text-[#9B9690]">No sessions scheduled today.</p>
        ) : (
          <div className="space-y-3">
            {schedule.map((sch) => (
              <div key={sch.id} className="p-4 rounded-xl bg-[#F7F5EE] border border-[#DFDACB] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-xs font-bold text-[#22355E] font-mono w-20">{sch.time}</div>
                  <div>
                    <h4 className="text-sm font-bold text-[#22355E]">{sch.subject}</h4>
                    <p className="text-xs text-[#6E6A64]">{sch.topic || 'No topic'} • {sch.room || 'No room'}</p>
                  </div>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded bg-[#EDEAE0] text-[#22355E] border border-[#DFDACB]">
                  {sch.duration}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
