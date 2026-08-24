import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, HelpCircle, Mail, ChevronDown, ChevronUp, Send, Check, MessageSquare } from 'lucide-react';
import { studentApiService } from '../../services/studentApiService';

export default function HelpSupportPage() {
  const [openFaq, setOpenFaq] = useState(0);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketBody, setTicketBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  const [tickets, setTickets] = useState([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);

  const loadTickets = useCallback(() => {
    setIsLoadingTickets(true);
    studentApiService
      .getSupportTickets()
      .then(setTickets)
      .catch(() => {})
      .finally(() => setIsLoadingTickets(false));
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const faqs = [
    {
      q: 'How does the Diya Streak system work?',
      a: 'Your Diya flame reflects your daily active learning consistency. Completing a lesson, submitting a task reflection, or taking a quiz maintains your daily streak. The flame grows stronger from Day 1 to Day 6+.',
    },
    {
      q: 'How are points earned and reflected on the leaderboard?',
      a: 'Points are awarded upon completing assignments (+30 pts) and quizzes (+50 pts max). Points immediately sync to your personal velocity chart and cohort standings without requiring a page reload.',
    },
    {
      q: 'Can I retake Parambh diagnostic quizzes?',
      a: 'Yes, you can retake quizzes anytime to improve your retention score and revisit answer explanations.',
    },
    {
      q: 'How do I submit assignments and reflection tasks?',
      a: 'Navigate to any pending task from your dashboard or tasks page, enter your reflections in the submission area, and click Submit.',
    },
  ];

  const handleTicketSubmit = async (e) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketBody.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setError('');
    try {
      await studentApiService.createSupportTicket({ subject: ticketSubject, message: ticketBody });
      setIsSubmitted(true);
      setTicketSubject('');
      setTicketBody('');
      loadTickets();
      setTimeout(() => setIsSubmitted(false), 4000);
    } catch (err) {
      setError(err.message || 'Could not submit your request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#EDEAE0] p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <Link
            to="/student/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#22355E] hover:text-[#AB5236] transition-colors mb-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-[#22355E]">
            Student Help & Academic Support
          </h1>
          <p className="text-xs text-[#2B2B28]/70 mt-0.5">
            Answers to common questions and direct contact channels with student support.
          </p>
        </div>

        {/* FAQs Accordion */}
        <div className="p-6 rounded-2xl bg-[#FAF9F4] border border-[#DFDACB] shadow-xs space-y-4">
          <h2 className="font-heading font-bold text-sm text-[#22355E] flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-[#22355E]" />
            <span>Frequently Asked Questions</span>
          </h2>

          <div className="space-y-2 divide-y divide-[#DFDACB]/60">
            {faqs.map((faq, idx) => (
              <div key={idx} className="pt-2">
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === idx ? -1 : idx)}
                  className="w-full flex items-center justify-between py-2 text-left font-heading font-semibold text-xs sm:text-sm text-[#22355E] hover:text-[#AB5236] transition-colors student-focus rounded"
                >
                  <span>{faq.q}</span>
                  {openFaq === idx ? (
                    <ChevronUp className="w-4 h-4 shrink-0 text-[#AB5236]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 shrink-0 text-[#2B2B28]/50" />
                  )}
                </button>
                {openFaq === idx && (
                  <p className="text-xs text-[#2B2B28]/80 leading-relaxed pb-2 pt-1 pl-1">
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* My Support Tickets */}
        <div className="p-6 rounded-2xl bg-[#FAF9F4] border border-[#DFDACB] shadow-xs space-y-3">
          <h2 className="font-heading font-bold text-sm text-[#22355E] flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#22355E]" />
            <span>My Support Requests</span>
          </h2>
          {isLoadingTickets ? (
            <p className="text-xs text-[#2B2B28]/60">Loading…</p>
          ) : tickets.length === 0 ? (
            <p className="text-xs text-[#2B2B28]/60">You haven't submitted any support requests yet.</p>
          ) : (
            <div className="space-y-2">
              {tickets.map((t) => (
                <div key={t._id} className="p-3 rounded-xl bg-white border border-[#DFDACB] space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#22355E]">{t.subject}</span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        t.status === 'open'
                          ? 'bg-[#C99A2E]/15 text-[#8F6A15] border border-[#C99A2E]/30'
                          : 'bg-[#5C7A5E]/15 text-[#5C7A5E] border border-[#5C7A5E]/30'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#2B2B28]/70 leading-relaxed line-clamp-2">{t.message}</p>
                  <p className="text-[10px] text-[#2B2B28]/50">{new Date(t.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contact Support Form */}
        <div className="p-6 rounded-2xl bg-[#FAF9F4] border border-[#DFDACB] shadow-xs space-y-4">
          <h2 className="font-heading font-bold text-sm text-[#22355E] flex items-center gap-2">
            <Mail className="w-4 h-4 text-[#AB5236]" />
            <span>Submit a Support Request</span>
          </h2>

          {isSubmitted ? (
            <div className="p-4 rounded-xl bg-[#FAF5EA] border border-[#5C7A5E] text-center text-xs text-[#5C7A5E] font-semibold flex items-center justify-center gap-2">
              <Check className="w-4 h-4" />
              <span>Your request has been received by student services! We will respond within 24 hours.</span>
            </div>
          ) : (
            <form onSubmit={handleTicketSubmit} className="space-y-3">
              {error && <p className="text-xs font-semibold text-[#AB5236]">{error}</p>}
              <div>
                <label className="block text-xs font-heading font-bold text-[#22355E] mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  placeholder="e.g. Question about Module 2 Task..."
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#DFDACB] rounded-xl text-xs text-[#2B2B28]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-heading font-bold text-[#22355E] mb-1">
                  Message Details
                </label>
                <textarea
                  rows={4}
                  placeholder="Describe your question or issue in detail..."
                  value={ticketBody}
                  onChange={(e) => setTicketBody(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#DFDACB] rounded-xl text-xs text-[#2B2B28]"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-[#AB5236] hover:bg-[#92422a] text-white text-xs font-heading font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 min-h-[44px] disabled:opacity-60"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Sending…' : 'Send Support Ticket'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
