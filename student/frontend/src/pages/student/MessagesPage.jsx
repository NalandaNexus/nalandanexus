import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { studentApiService } from '../../services/studentApiService';
import { getSocket } from '../../services/socket';

function formatTime(iso) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function MessagesPage() {
  const [messages, setMessages] = useState([]);
  const [teacherName, setTeacherName] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    studentApiService
      .getMessages()
      .then(({ messages: data, teacherName: name }) => {
        if (!cancelled) {
          setMessages(data);
          setTeacherName(name);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Unable to load messages.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Real-time: a reply from the teacher arrives instantly without a manual refresh.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;
    const handler = (message) => setMessages((prev) => [...prev, message]);
    socket.on('message.created', handler);
    return () => socket.off('message.created', handler);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    const body = inputText.trim();
    if (!body || isSending) return;

    setIsSending(true);
    setInputText('');
    try {
      const saved = await studentApiService.sendMessage(body);
      setMessages((prev) => [...prev, saved]);
    } catch (err) {
      setError(err.message || 'Could not send your message. Please try again.');
      setInputText(body);
    } finally {
      setIsSending(false);
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
            Messages
          </h1>
          <p className="text-xs text-[#2B2B28]/70 mt-0.5">
            Direct, persisted communication channel with {teacherName ? teacherName : 'your teacher'}.
          </p>
        </div>

        {/* Chat Box */}
        <div className="bg-[#FAF9F4] border border-[#DFDACB] rounded-2xl shadow-xs overflow-hidden flex flex-col h-[520px]">
          {/* Channel Header */}
          <div className="p-4 bg-[#F2EFE6] border-b border-[#DFDACB] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#22355E] text-white flex items-center justify-center font-bold text-xs">
                {teacherName ? teacherName.slice(0, 2).toUpperCase() : 'T'}
              </div>
              <div>
                <h3 className="font-heading font-bold text-xs text-[#22355E]">{teacherName || 'Your Teacher'}</h3>
                <span className="text-[10px] text-[#5C7A5E] font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#5C7A5E]" />
                  PRARAMBH Support
                </span>
              </div>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {isLoading ? (
              <div className="p-6 text-center text-xs text-[#2B2B28]/60">Loading conversation…</div>
            ) : messages.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#2B2B28]/60">
                No messages yet. Say hello to {teacherName || 'your teacher'}!
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg._id}
                  className={`flex flex-col max-w-md ${
                    msg.sender === 'teacher' ? 'items-start mr-auto' : 'items-end ml-auto'
                  }`}
                >
                  <span className="text-[10px] text-[#2B2B28]/60 font-semibold mb-1">
                    {msg.sender === 'teacher' ? msg.teacherName || teacherName || 'Teacher' : 'You'} · {formatTime(msg.createdAt)}
                  </span>
                  <div
                    className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                      msg.sender === 'teacher'
                        ? 'bg-white border border-[#DFDACB] text-[#2B2B28] rounded-tl-xs shadow-2xs'
                        : 'bg-[#22355E] text-white rounded-tr-xs shadow-2xs'
                    }`}
                  >
                    {msg.body}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {error && <p className="px-4 text-xs font-semibold text-[#AB5236]">{error}</p>}

          {/* Input Form */}
          <form
            onSubmit={handleSend}
            className="p-3 bg-[#F2EFE6] border-t border-[#DFDACB] flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Ask a question or reply to your mentor..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isSending}
              className="flex-1 px-3.5 py-2.5 text-xs bg-white border border-[#DFDACB] rounded-xl text-[#2B2B28] placeholder-[#2B2B28]/40 focus:outline-none focus:ring-2 focus:ring-[#22355E] disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isSending || !inputText.trim()}
              className="px-4 py-2.5 bg-[#AB5236] hover:bg-[#92422a] text-white text-xs font-heading font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors min-h-[44px] disabled:opacity-60"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
