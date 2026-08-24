import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Video, Play, Clock } from 'lucide-react';
import { studentApiService } from '../../services/studentApiService';
import { getSocket } from '../../services/socket';

function formatSchedule(iso) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function LiveClassesPage() {
  const [upcoming, setUpcoming] = useState([]);
  const [recorded, setRecorded] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLiveClasses = useCallback(() => {
    return studentApiService
      .getLiveClasses()
      .then((data) => {
        setUpcoming(data.upcoming || []);
        setRecorded(data.recorded || []);
      })
      .catch((err) => {
        setError(err.message || 'Unable to load live classes.');
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    loadLiveClasses().finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [loadLiveClasses]);

  // Real-time: a teacher scheduling/cancelling a lecture, or the server's
  // status sweep flipping a session to "live", refreshes this list without
  // a manual reload (master doc §4: "the student should NOT need to
  // manually refresh the page").
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;
    const handler = () => loadLiveClasses();
    socket.on('course:lecture_created', handler);
    socket.on('course:lecture_live', handler);
    socket.on('course:lecture_cancelled', handler);
    socket.on('course:lecture_rescheduled', handler);
    return () => {
      socket.off('course:lecture_created', handler);
      socket.off('course:lecture_live', handler);
      socket.off('course:lecture_cancelled', handler);
      socket.off('course:lecture_rescheduled', handler);
    };
  }, [loadLiveClasses]);

  return (
    <div className="w-full min-h-screen bg-[#EDEAE0] p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <div>
          <Link
            to="/student/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#22355E] hover:text-[#AB5236] transition-colors mb-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-[#22355E]">
            Live Interactive Classes & Recordings
          </h1>
          <p className="text-xs text-[#2B2B28]/70 mt-0.5">
            Join weekly cohort sessions with senior mentors and watch past deep-dive workshops.
          </p>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-xs text-[#2B2B28]/60">Loading live classes…</div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-[#AB5236] bg-[#FAF9F4] border border-[#DFDACB] rounded-2xl">{error}</div>
        ) : (
          <>
            {/* Section 1: Upcoming Live Sessions */}
            <div className="space-y-3">
              <h2 className="font-heading font-bold text-sm text-[#22355E] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#AB5236] animate-ping" />
                <span>Upcoming Scheduled Masterclasses</span>
              </h2>

              {upcoming.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#2B2B28]/60 bg-[#FAF9F4] border border-[#DFDACB] rounded-2xl">
                  No upcoming live sessions scheduled right now.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {upcoming.map((cls) => (
                    <div
                      key={cls._id}
                      className="p-5 rounded-2xl bg-[#FAF9F4] border border-[#DFDACB] shadow-xs flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 text-[10px] font-bold font-data rounded bg-[#AB5236] text-white uppercase">
                            Live Cohort
                          </span>
                          <span className="text-xs font-data font-semibold text-[#22355E] flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-[#AB5236]" />
                            {formatSchedule(cls.scheduledAt)}
                          </span>
                        </div>

                        <h3 className="font-heading font-bold text-sm sm:text-base text-[#22355E] leading-snug">
                          {cls.title}
                        </h3>

                        <p className="text-xs text-[#2B2B28]/80 font-medium">
                          Instructor: <strong className="text-[#22355E]">{cls.instructor}</strong>
                        </p>
                      </div>

                      {cls.joinUrl ? (
                        <a
                          href={cls.joinUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full py-2.5 bg-[#22355E] hover:bg-[#1a2949] text-white text-xs font-heading font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 min-h-[44px] student-focus"
                        >
                          <Video className="w-4 h-4 text-[#C99A2E]" />
                          <span>Join Classroom Room</span>
                        </a>
                      ) : (
                        <span className="w-full py-2.5 bg-[#EDEAE0] text-[#2B2B28]/60 text-xs font-heading font-bold rounded-xl flex items-center justify-center gap-2 min-h-[44px]">
                          Join link available soon
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 2: Recorded Class Archives */}
            <div className="space-y-3 pt-4">
              <h2 className="font-heading font-bold text-sm text-[#22355E]">Recorded Class Library</h2>

              {recorded.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#2B2B28]/60 bg-[#FAF9F4] border border-[#DFDACB] rounded-2xl">
                  No recordings available yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {recorded.map((rec) => (
                    <div
                      key={rec._id}
                      className="p-4 rounded-xl bg-[#FAF9F4] border border-[#DFDACB] flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2.5 rounded-xl bg-[#22355E] text-white shrink-0">
                          <Play className="w-4 h-4 fill-white" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-heading font-bold text-xs sm:text-sm text-[#22355E] truncate">
                            {rec.title}
                          </h4>
                          <p className="text-[11px] text-[#2B2B28]/65">
                            {rec.instructor} · Held on {formatSchedule(rec.scheduledAt)}
                          </p>
                        </div>
                      </div>

                      {rec.recordingUrl ? (
                        <a
                          href={rec.recordingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-4 py-2 bg-white hover:bg-[#EDEAE0] border border-[#DFDACB] text-[#22355E] text-xs font-bold rounded-xl transition-colors shrink-0"
                        >
                          Watch Recording
                        </a>
                      ) : (
                        <span className="px-4 py-2 text-[#2B2B28]/50 text-xs font-bold shrink-0">Unavailable</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
