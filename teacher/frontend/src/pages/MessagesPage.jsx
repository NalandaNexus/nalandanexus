import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Send } from 'lucide-react';
import { teacherApiService, ApiClientError } from '../services/teacherApiService';
import { socketService } from '../services/socketService';

export default function MessagesPage() {
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  const fetchConversations = useCallback(async () => {
    try {
      setError(null);
      const data = await teacherApiService.getConversations();
      setConversations(data || []);
      setSelectedId((prev) => prev || data?.[0]?.id || null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load conversations.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const loadMessages = useCallback(async (id) => {
    if (!id) return;
    try {
      const data = await teacherApiService.getMessages(id);
      setMessages(data || []);
      teacherApiService.markConversationRead(id).catch(() => {});
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unread: false, unreadCount: 0 } : c)));
    } catch {
      setMessages([]);
    }
  }, []);

  useEffect(() => {
    loadMessages(selectedId);
  }, [selectedId, loadMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    socketService.connect();
    const unbind = socketService.on('message.created', (payload) => {
      fetchConversations();
      if (payload?.conversationId === selectedId) {
        setMessages((prev) => [...prev, payload.message]);
      }
    });
    return unbind;
  }, [selectedId, fetchConversations]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedId) return;
    const text = replyText;
    setReplyText('');
    try {
      const message = await teacherApiService.sendMessage(selectedId, text);
      setMessages((prev) => [...prev, message]);
      fetchConversations();
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : 'Failed to send message.');
    }
  };

  const selectedThread = conversations.find((c) => c.id === selectedId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#22355E] font-display">Faculty Messaging Hub</h1>
        <p className="text-xs text-[#6E6A64] mt-1">Direct communication with your students.</p>
      </div>

      {error && <div className="p-3.5 rounded-xl bg-[#C1352B]/10 border border-[#C1352B]/30 text-[#C1352B] text-xs">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-[550px] rounded-2xl border border-[#DFDACB] bg-[#FFFFFF] overflow-hidden">
        <div className="md:col-span-4 border-r border-[#DFDACB] bg-[#F7F5EE] p-3 space-y-2 overflow-y-auto">
          {isLoading ? (
            <p className="text-xs text-[#9B9690] text-center py-6">Loading…</p>
          ) : conversations.length === 0 ? (
            <p className="text-xs text-[#9B9690] text-center py-6">No conversations yet.</p>
          ) : (
            conversations.map((th) => (
              <div
                key={th.id}
                onClick={() => setSelectedId(th.id)}
                className={`p-3 rounded-xl cursor-pointer transition-all ${
                  selectedId === th.id ? 'bg-[#22355E] text-white shadow-xs' : 'bg-[#FFFFFF] text-[#2B2B28] hover:bg-[#EDEAE0]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    {th.name}
                    {th.unread && <span className="w-1.5 h-1.5 rounded-full bg-[#C1352B]" />}
                  </span>
                  <span className={`text-[10px] ${selectedId === th.id ? 'text-[#EDEAE0]/70' : 'text-[#6E6A64]'}`}>
                    {th.lastMessageAt ? new Date(th.lastMessageAt).toLocaleDateString() : ''}
                  </span>
                </div>
                <p className={`text-xs truncate mt-1 ${selectedId === th.id ? 'text-[#EDEAE0]/90' : 'text-[#6E6A64]'}`}>{th.lastMessage || 'No messages yet'}</p>
              </div>
            ))
          )}
        </div>

        <div className="md:col-span-8 flex flex-col justify-between p-4 bg-[#FFFFFF]">
          {!selectedThread ? (
            <div className="flex-1 flex items-center justify-center text-xs text-[#9B9690]">Select a conversation.</div>
          ) : (
            <>
              <div className="pb-3 border-b border-[#DFDACB]">
                <h3 className="text-sm font-bold text-[#22355E]">{selectedThread.name}</h3>
              </div>

              <div ref={scrollRef} className="flex-1 space-y-3 p-4 overflow-y-auto">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`p-3 rounded-xl max-w-sm text-xs ${
                      m.senderRole === 'teacher' ? 'bg-[#22355E] text-white ml-auto' : 'bg-[#F7F5EE] border border-[#DFDACB] text-[#2B2B28]'
                    }`}
                  >
                    {m.text}
                  </div>
                ))}
              </div>

              <form onSubmit={handleSend} className="flex items-center gap-2 pt-3 border-t border-[#DFDACB]">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write response..."
                  className="flex-1 bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3 py-2 text-xs text-[#2B2B28] focus:outline-none focus:border-[#22355E]"
                />
                <button type="submit" className="px-4 py-2 rounded-xl bg-[#AB5236] hover:bg-[#94452C] text-white text-xs font-bold transition-all shadow-cta flex items-center gap-1">
                  <Send className="w-3.5 h-3.5" /> Send
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
