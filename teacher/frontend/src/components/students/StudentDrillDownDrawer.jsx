import React, { useState } from 'react';
import {
  X,
  User,
  Mail,
  Award,
  Calendar,
  Clock,
  Send,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
} from 'lucide-react';
import RiskPulseIndicator from '../common/RiskPulseIndicator';
import { teacherApiService } from '../../services/teacherApiService';

export default function StudentDrillDownDrawer({
  isOpen,
  onClose,
  student,
}) {
  const [activeTab, setActiveTab] = useState('diagnostics');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [noticeSent, setNoticeSent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');

  if (!isOpen || !student) return null;

  const handleSendNotice = async (e) => {
    e.preventDefault();
    if (!noticeMessage.trim() || isSending) return;
    setIsSending(true);
    setSendError('');
    try {
      const conversation = await teacherApiService.startConversation(student.id);
      await teacherApiService.sendMessage(conversation.id, noticeMessage.trim());
      setNoticeSent(true);
      setNoticeMessage('');
      setTimeout(() => setNoticeSent(false), 3000);
    } catch (err) {
      setSendError(err.message || 'Could not send this notice. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const isActNow = student.riskLevel === 'act_now' || student.riskLevel === 'critical';
  const isWatch = student.riskLevel === 'watch';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#22355E]/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-[#FFFFFF] border-l border-[#DFDACB] shadow-dropdown flex flex-col h-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-5 sm:p-6 bg-[#F7F5EE] border-b border-[#DFDACB] flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative flex-shrink-0">
              <img
                src={student.avatar}
                alt={student.name}
                className="w-14 h-14 rounded-2xl object-cover border border-[#DFDACB] bg-[#EDEAE0]"
              />
              <div className="absolute -top-1 -right-1">
                <RiskPulseIndicator level={student.riskLevel} size="md" />
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-[#22355E] font-display truncate">
                  {student.name}
                </h3>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#EDEAE0] text-[#22355E] border border-[#DFDACB]">
                  {student.className}
                </span>
              </div>
              <p className="text-xs text-[#6E6A64] mt-0.5 truncate">{student.email}</p>
              {/* The student's profile as the student portal holds it. */}
              {(student.enrollmentNumber || student.grade || student.guardianName || student.phone) && (
                <p className="text-[11px] text-[#6E6A64] mt-0.5 truncate">
                  {[student.enrollmentNumber, student.grade, student.guardianName && `Guardian: ${student.guardianName}`, student.phone]
                    .filter(Boolean)
                    .join(' • ')}
                </p>
              )}

              {student.atRiskReason && (
                <div className="mt-1.5">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded border ${
                      isActNow
                        ? 'bg-[#C1352B]/15 text-[#C1352B] border-[#C1352B]/30'
                        : isWatch
                        ? 'bg-[#C99A2E]/15 text-[#8F6A15] border-[#C99A2E]/30'
                        : 'bg-[#5C7A5E]/15 text-[#5C7A5E] border-[#5C7A5E]/30'
                    }`}
                  >
                    {student.atRiskReason}
                  </span>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close Drawer"
            className="p-2 rounded-xl bg-[#FFFFFF] hover:bg-[#EDEAE0] text-[#6E6A64] hover:text-[#2B2B28] transition-colors border border-[#DFDACB]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 bg-[#F7F5EE] border-b border-[#DFDACB] flex items-center gap-2 overflow-x-auto text-xs">
          {[
            { id: 'diagnostics', label: 'Academic Diagnostics' },
            { id: 'timeline', label: 'Submissions & Quizzes' },
            { id: 'attendance', label: 'Attendance Record' },
            { id: 'contact', label: 'Dispatch Notice' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-3 font-bold border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-[#AB5236] text-[#22355E]'
                  : 'border-transparent text-[#6E6A64] hover:text-[#2B2B28]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Drawer Body Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#FFFFFF]">
          {activeTab === 'diagnostics' && (
            <div className="space-y-6">
              {/* Score Benchmark Gap */}
              <div className="p-4 rounded-xl bg-[#F7F5EE] border border-[#DFDACB] grid grid-cols-3 gap-3 text-center">
                <div>
                  <span className="text-[11px] text-[#6E6A64]">Student Score</span>
                  <div className="text-xl font-extrabold text-[#22355E] font-mono tabular-nums mt-0.5">
                    {student.score}%
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-[#6E6A64]">Class Mean</span>
                  <div className="text-xl font-extrabold text-[#6E6A64] font-mono tabular-nums mt-0.5">
                    {student.classAverage ?? 0}%
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-[#6E6A64]">Benchmark Gap</span>
                  <div
                    className={`text-xl font-extrabold font-mono tabular-nums mt-0.5 ${
                      student.score - (student.classAverage ?? 0) < 0
                        ? 'text-[#C1352B]'
                        : 'text-[#5C7A5E]'
                    }`}
                  >
                    {student.score - (student.classAverage ?? 0) >= 0 ? '+' : ''}
                    {student.score - (student.classAverage ?? 0)}%
                  </div>
                </div>
              </div>

              {/* Concept Breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#22355E]">
                  Syllabus Domain Proficiency
                </h4>
                <div className="space-y-2">
                  {student.conceptScores?.map((cs) => (
                    <div
                      key={cs.topic}
                      className="p-3 rounded-xl bg-[#F7F5EE] border border-[#DFDACB] space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#22355E]">{cs.topic}</span>
                        <span
                          className={`font-mono font-bold ${
                            cs.score < 60
                              ? 'text-[#C1352B]'
                              : cs.score >= 80
                              ? 'text-[#5C7A5E]'
                              : 'text-[#8F6A15]'
                          }`}
                        >
                          {cs.score}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-[#EDEAE0] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            cs.score < 60
                              ? 'bg-[#C1352B]'
                              : cs.score >= 80
                              ? 'bg-[#5C7A5E]'
                              : 'bg-[#C99A2E]'
                          }`}
                          style={{ width: `${cs.score}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#22355E]">
                Submissions &amp; Quizzes
              </h4>
              <div className="space-y-2">
                {!student.submissions?.length && (
                  <p className="text-xs text-[#6E6A64] text-center py-6">No submissions on record yet.</p>
                )}
                {student.submissions?.map((item) => {
                  const percent = item.score != null && item.maxScore ? Math.round((item.score / item.maxScore) * 100) : null;
                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-[#F7F5EE] border border-[#DFDACB] flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-[#22355E] block">{item.title}</span>
                        <span className="text-[10px] text-[#6E6A64]">
                          {item.submittedAt ? new Date(item.submittedAt).toLocaleDateString() : item.status}
                        </span>
                      </div>
                      {percent !== null ? (
                        <span
                          className={`font-mono font-bold ${
                            percent < 60 ? 'text-[#C1352B]' : percent >= 80 ? 'text-[#5C7A5E]' : 'text-[#8F6A15]'
                          }`}
                        >
                          {percent}%
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase text-[#6E6A64]">{item.status}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#F7F5EE] border border-[#DFDACB] flex items-center justify-between">
                <span className="text-xs font-semibold text-[#6E6A64]">Overall Attendance Rate</span>
                <span className="text-2xl font-extrabold text-[#22355E] font-mono">
                  {student.attendanceRate}%
                </span>
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#22355E]">7-Day Attendance Log</h4>
                {student.attendanceHistory?.map((day, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-[#F7F5EE] border border-[#DFDACB] flex items-center justify-between text-xs"
                  >
                    <span className="text-[#2B2B28] font-medium">{day.date}</span>
                    <span
                      className={`font-bold uppercase text-[10px] px-2 py-0.5 rounded ${
                        day.status === 'present'
                          ? 'bg-[#5C7A5E]/15 text-[#5C7A5E] border border-[#5C7A5E]/30'
                          : day.status === 'late'
                          ? 'bg-[#C99A2E]/15 text-[#8F6A15] border border-[#C99A2E]/30'
                          : 'bg-[#C1352B]/15 text-[#C1352B] border border-[#C1352B]/30'
                      }`}
                    >
                      {day.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'contact' && (
            <form onSubmit={handleSendNotice} className="space-y-4">
              {noticeSent && (
                <div className="p-3 rounded-xl bg-[#5C7A5E]/15 border border-[#5C7A5E]/30 text-xs text-[#5C7A5E] font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Message sent to {student.name}.
                </div>
              )}
              {sendError && (
                <div className="p-3 rounded-xl bg-[#C1352B]/15 border border-[#C1352B]/30 text-xs text-[#C1352B] font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> {sendError}
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-[#22355E] block mb-1.5">
                  Direct Notice Message
                </label>
                <textarea
                  rows={4}
                  value={noticeMessage}
                  onChange={(e) => setNoticeMessage(e.target.value)}
                  placeholder={`Write note to ${student.name} regarding homework submissions or doubt sessions...`}
                  className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl p-3 text-xs text-[#2B2B28] placeholder-[#6E6A64] focus:outline-none focus:border-[#22355E]"
                />
              </div>

              {/* Primary CTA Button (Brick Terracotta: #AB5236) */}
              <button
                type="submit"
                disabled={!noticeMessage.trim() || isSending}
                className="w-full py-2.5 rounded-xl bg-[#AB5236] hover:bg-[#94452C] text-white font-bold text-xs transition-all shadow-cta flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSending ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>{isSending ? 'Sending…' : 'Send Message'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
