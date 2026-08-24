import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, CheckCircle2 } from 'lucide-react';
import EmptyState from '../components/common/EmptyState';
import { adminApi } from '../services/adminApi';
import { useRealtimeEvents } from '../hooks/useRealtimeEvents';

const STATUS_STYLE = {
  PAID: 'bg-[#5C7A5E]/15 text-[#5C7A5E] border-[#5C7A5E]/30',
  PENDING: 'bg-[#C99A2E]/15 text-[#C99A2E] border-[#C99A2E]/30',
  FAILED: 'bg-[#C1352B]/15 text-[#C1352B] border-[#C1352B]/30',
  REFUNDED: 'bg-[#9B9690]/15 text-[#9B9690] border-[#9B9690]/30',
};

function formatINR(amount) {
  return `₹ ${Number(amount || 0).toLocaleString('en-IN')}`;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState({ totalCollected: 0, totalPending: 0, pendingCount: 0 });
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);
  const [formData, setFormData] = useState({ student: '', amount: '', method: 'CASH', description: '' });

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const fetchPayments = async () => {
    try {
      setIsLoading(true);
      const { items, meta } = await adminApi.getPayments({ limit: 50 });
      setPayments(items);
      setSummary(meta?.summary || {});
    } catch (err) {
      showToast(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
    adminApi
      .getStudents({ limit: 100 })
      .then(setStudents)
      .catch(() => showToast('Could not load students — the student dropdown will be empty.'));
  }, []);

  useRealtimeEvents(['payment.created', 'payment.updated'], fetchPayments);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await adminApi.createPayment({ ...formData, amount: Number(formData.amount) });
      showToast('Payment record created');
      setCreateModalOpen(false);
      setFormData({ student: '', amount: '', method: 'CASH', description: '' });
      fetchPayments();
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleMarkPaid = async (id) => {
    try {
      await adminApi.updatePaymentStatus(id, 'PAID');
      showToast('Payment marked as paid');
      fetchPayments();
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleMarkRefunded = async (id) => {
    if (!window.confirm('Mark this payment as refunded? This cannot be undone.')) return;
    try {
      await adminApi.updatePaymentStatus(id, 'REFUNDED');
      showToast('Payment marked as refunded');
      fetchPayments();
    } catch (err) {
      showToast(err.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-[#22355E] text-white border border-[#22355E] shadow-2xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-[#5C7A5E]" />
          <span className="text-xs font-semibold">{toastMsg}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#DFDACB]/80 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#22355E]">Institutional Financial Ledger</h1>
          <p className="text-xs text-[#9B9690] mt-1">
            Track student tuition fee collections and examination dues, recorded and managed directly by Admin.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-[#22355E] hover:bg-[#1A2A4A] text-white text-xs font-semibold transition-all shadow-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Record Payment</span>
        </button>
      </div>

      <div className="bg-[#22355E]/5 border border-[#22355E]/20 rounded-2xl p-3 text-[11px] text-[#22355E]">
        "Razorpay"-tagged rows below are real, signature-verified course purchases bridged live from the Student
        Portal's own backend — never a client-asserted status. "Manual" rows are fee entries recorded directly by an
        admin (cash, bank transfer, etc.) against an institutional student record.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#DFDACB] rounded-2xl p-5 shadow-card">
          <div className="text-xs text-[#9B9690] uppercase font-semibold">Total Collected</div>
          <div className="text-2xl font-bold font-mono text-[#22355E] mt-2">{formatINR(summary.totalCollected)}</div>
        </div>
        <div className="bg-white border border-[#DFDACB] rounded-2xl p-5 shadow-card">
          <div className="text-xs text-[#9B9690] uppercase font-semibold">Pending Dues</div>
          <div className="text-2xl font-bold font-mono text-[#AB5236] mt-2">{formatINR(summary.totalPending)}</div>
          <div className="text-[11px] text-[#9B9690] mt-1">{summary.pendingCount || 0} accounts pending payment</div>
        </div>
        <div className="bg-white border border-[#DFDACB] rounded-2xl p-5 shadow-card">
          <div className="text-xs text-[#9B9690] uppercase font-semibold">Refunded</div>
          <div className="text-2xl font-bold font-mono text-[#9B9690] mt-2">{formatINR(summary.totalRefunded)}</div>
        </div>
      </div>

      <div className="bg-white border border-[#DFDACB] rounded-2xl shadow-card overflow-hidden">
        <div className="p-4 bg-[#F7F5EE] border-b border-[#DFDACB] flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#22355E]">Recent Transactions</h3>
        </div>
        {isLoading ? (
          <div className="p-12 text-center text-xs text-[#9B9690]">Loading transactions...</div>
        ) : payments.length === 0 ? (
          <div className="p-8">
            <EmptyState title="No payment records yet" description="Payments you record will appear here." />
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F7F5EE]/60 border-b border-[#DFDACB] text-[#9B9690] font-semibold">
              <tr>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Source</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDEAE0] text-[#2B2B28]">
              {payments.map((tx) => (
                <tr key={tx.id} className="hover:bg-[#F7F5EE]/60 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-[#22355E]">
                    {tx.student?.name || tx.externalStudentName || 'Unknown'}
                    {!tx.student && tx.externalStudentEmail && (
                      <div className="text-[10px] font-normal text-[#9B9690]">{tx.externalStudentEmail}</div>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-[#9B9690]">{tx.description || '—'}</td>
                  <td className="py-3.5 px-4">
                    {tx.source === 'razorpay' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#22355E]/10 text-[#22355E] border border-[#22355E]/20">
                        Razorpay
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#9B9690]/10 text-[#9B9690] border border-[#9B9690]/20">
                        Manual
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-[#5C7A5E]">{formatINR(tx.amount)}</td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-[#9B9690]">{new Date(tx.createdAt).toLocaleDateString()}</td>
                  <td className="py-3.5 px-4 text-right">
                    {tx.status === 'PENDING' ? (
                      <button
                        type="button"
                        onClick={() => handleMarkPaid(tx.id)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${STATUS_STYLE.PENDING} hover:bg-[#5C7A5E] hover:text-white transition-colors`}
                      >
                        Mark Paid
                      </button>
                    ) : tx.status === 'PAID' ? (
                      <button
                        type="button"
                        onClick={() => handleMarkRefunded(tx.id)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${STATUS_STYLE.PAID} hover:bg-[#9B9690] hover:text-white transition-colors`}
                        title="Mark refunded"
                      >
                        PAID
                      </button>
                    ) : (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${STATUS_STYLE[tx.status]}`}>{tx.status}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#22355E]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#DFDACB] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#22355E]">Record New Payment</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#2B2B28] mb-1">Student</label>
                <select
                  required
                  value={formData.student}
                  onChange={(e) => setFormData({ ...formData, student: e.target.value })}
                  className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs text-[#2B2B28]"
                >
                  <option value="">Select a student</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.rollNo})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-[#2B2B28] mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3 py-2 text-xs font-mono text-[#2B2B28]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#2B2B28] mb-1">Method</label>
                  <select
                    value={formData.method}
                    onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                    className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3 py-2 text-xs text-[#2B2B28]"
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CARD">Card</option>
                    <option value="UPI">UPI</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#2B2B28] mb-1">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Term 1 Tuition Fee"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs text-[#2B2B28]"
                />
              </div>
              <div className="pt-3 border-t border-[#EDEAE0] flex justify-end gap-2">
                <button type="button" onClick={() => setCreateModalOpen(false)} className="px-4 py-2 rounded-xl bg-[#EDEAE0] text-xs font-semibold text-[#2B2B28]">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-[#22355E] hover:bg-[#1A2A4A] text-white text-xs font-semibold">
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
