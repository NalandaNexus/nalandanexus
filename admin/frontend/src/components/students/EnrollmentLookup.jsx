import React, { useState } from 'react';
import { Search, Hash, User, Users, GraduationCap, Phone, Mail, X, CreditCard, Ticket } from 'lucide-react';
import { adminApi } from '../../services/adminApi';

/**
 * Search Student by Enrollment Number.
 *
 * Reads the student service, which issues enrollment numbers, through the admin
 * backend. students.read is needed to search; payment status, purchase method,
 * coupons and Razorpay references arrive only for an admin who also holds
 * payments.view - the backend leaves them out otherwise, so this component
 * simply shows what it is given.
 */

function normalizeEnrollmentNumber(raw) {
  const compact = String(raw ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const match = /^NN(\d{2})(\d{6,9})$/.exec(compact);
  return match ? `NN${match[1]}-${match[2]}` : null;
}

const formatPhone = (phone) => {
  const match = /^\+91(\d{5})(\d{5})$/.exec(phone || '');
  return match ? `+91 ${match[1]} ${match[2]}` : phone;
};
const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const formatAmount = (paise) => (typeof paise === 'number' ? `₹${(paise / 100).toLocaleString('en-IN')}` : '—');

const METHOD_LABEL = { RAZORPAY: 'Razorpay payment', COUPON: 'Coupon', FREE: 'Free enrolment' };
const STATUS_STYLE = {
  active: 'bg-[#5C7A5E]/10 text-[#5C7A5E]',
  paid: 'bg-[#5C7A5E]/10 text-[#5C7A5E]',
  created: 'bg-[#C99A2E]/10 text-[#8A6A1F]',
  failed: 'bg-[#C1352B]/10 text-[#C1352B]',
  revoked: 'bg-[#C1352B]/10 text-[#C1352B]',
};

function Pill({ value }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${STATUS_STYLE[value] || 'bg-[#EDEAE0] text-[#22355E]'}`}>
      {value || '—'}
    </span>
  );
}

function Detail({ icon: Icon, label, value, mono = false }) {
  return (
    <div className="p-3 rounded-xl bg-[#F7F5EE] border border-[#DFDACB] min-w-0">
      <dt className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-[#9B9690]">
        <Icon className="w-3 h-3" aria-hidden="true" />
        {label}
      </dt>
      <dd className={`mt-1 text-xs font-bold text-[#22355E] break-words ${mono ? 'font-mono' : ''}`}>
        {value || <span className="font-normal text-[#9B9690]">Not provided yet</span>}
      </dd>
    </div>
  );
}

function Table({ columns, rows, empty }) {
  if (!rows.length) return <p className="text-xs text-[#9B9690]">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-[#DFDACB]">
      <table className="w-full text-left text-xs">
        <thead className="bg-[#F7F5EE] text-[#9B9690]">
          <tr>
            {columns.map((c) => (
              <th key={c} scope="col" className="px-3 py-2 font-semibold whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#DFDACB]">{rows}</tbody>
      </table>
    </div>
  );
}

export default function EnrollmentLookup() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | found | missing | error
  const [student, setStudent] = useState(null);
  const [message, setMessage] = useState('');

  const handleSearch = async (event) => {
    event.preventDefault();
    const enrollmentNumber = normalizeEnrollmentNumber(query);
    setStudent(null);
    if (!enrollmentNumber) {
      setStatus('error');
      setMessage('Enter a valid enrollment number, for example NN26-000124.');
      return;
    }
    setStatus('loading');
    setMessage('');
    try {
      setStudent(await adminApi.findStudentByEnrollmentNumber(enrollmentNumber));
      setStatus('found');
    } catch (err) {
      setStatus(err.status === 404 ? 'missing' : 'error');
      setMessage(err.message || 'Search failed. Please try again.');
    }
  };

  const clear = () => {
    setQuery('');
    setStudent(null);
    setStatus('idle');
    setMessage('');
  };

  return (
    <section className="bg-white border border-[#DFDACB] rounded-2xl p-4 shadow-card space-y-4" aria-labelledby="admin-enrollment-search-title">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 id="admin-enrollment-search-title" className="text-sm font-bold text-[#22355E]">
            Search Student by Enrollment Number
          </h2>
          <p className="text-[11px] text-[#9B9690]">Looks up any student-portal student by the number issued with their first course.</p>
        </div>
        <form onSubmit={handleSearch} className="flex w-full md:w-auto items-center gap-2" role="search">
          <label htmlFor="admin-enrollment-number" className="sr-only">
            Enrollment number
          </label>
          <div className="relative flex-1 md:w-72">
            <Hash className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9B9690]" aria-hidden="true" />
            <input
              id="admin-enrollment-number"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="NN26-000124"
              autoComplete="off"
              spellCheck={false}
              maxLength={40}
              className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl pl-9 pr-4 py-2 text-xs font-mono text-[#2B2B28] placeholder-[#9B9690] focus:outline-none focus:border-[#22355E]"
            />
          </div>
          <button
            type="submit"
            disabled={status === 'loading'}
            className="px-4 py-2 rounded-xl bg-[#22355E] hover:bg-[#1A2A4A] disabled:opacity-60 text-white text-xs font-semibold transition-all shadow-sm flex items-center gap-2"
          >
            {status === 'loading' ? (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>Search</span>
          </button>
        </form>
      </div>

      <div aria-live="polite">
        {(status === 'missing' || status === 'error') && message && (
          <div
            className={`p-3 rounded-xl text-xs border ${
              status === 'missing' ? 'bg-[#F7F5EE] border-[#DFDACB] text-[#9B9690]' : 'bg-[#C1352B]/10 border-[#C1352B]/30 text-[#C1352B]'
            }`}
          >
            {message}
          </div>
        )}

        {status === 'found' && student && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-[#22355E] truncate">Student Details</h3>
                <p className="text-[11px] text-[#9B9690]">
                  {student.profileComplete ? 'Profile complete' : 'Profile not yet completed by the student'}
                  {student.profileCompletedAt ? ` · completed ${formatDate(student.profileCompletedAt)}` : ''}
                </p>
              </div>
              <button type="button" onClick={clear} aria-label="Clear search" className="p-1.5 rounded-lg text-[#9B9690] hover:bg-[#F7F5EE] hover:text-[#22355E]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              <Detail icon={Hash} label="Enrollment Number" value={student.enrollmentNumber} mono />
              <Detail icon={User} label="Full Name" value={student.fullName} />
              <Detail icon={Users} label="Parent/Guardian Name" value={student.guardianName} />
              <Detail icon={GraduationCap} label="Class" value={student.grade} />
              <Detail icon={Phone} label="Phone" value={formatPhone(student.phone)} />
              <Detail icon={Mail} label="Email" value={student.email} />
            </dl>

            <div>
              <h4 className="text-[10px] uppercase tracking-wider font-bold text-[#9B9690] mb-1.5">Course Enrollments</h4>
              <Table
                columns={['Course', 'Enrollment ID', 'Status', 'Enrollment Date', 'Batch', ...(student.paymentsVisible ? ['Purchase Method'] : [])]}
                empty="No course enrolments."
                rows={(student.enrollments || []).map((e) => (
                  <tr key={e.enrollmentId || e.courseSlug}>
                    <td className="px-3 py-2 font-semibold text-[#22355E]">{e.courseTitle || e.courseSlug}</td>
                    <td className="px-3 py-2 font-mono text-[#2B2B28] whitespace-nowrap">{e.enrollmentId || '—'}</td>
                    <td className="px-3 py-2"><Pill value={e.status} /></td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(e.enrolledAt)}</td>
                    <td className="px-3 py-2">{e.batchCode || '—'}</td>
                    {student.paymentsVisible && <td className="px-3 py-2 whitespace-nowrap">{METHOD_LABEL[e.purchaseMethod] || '—'}</td>}
                  </tr>
                ))}
              />
            </div>

            {student.paymentsVisible ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider font-bold text-[#9B9690] mb-1.5 flex items-center gap-1">
                    <CreditCard className="w-3 h-3" aria-hidden="true" /> Payments
                  </h4>
                  <Table
                    columns={['Course', 'Status', 'Amount', 'Razorpay Reference', 'Date']}
                    empty="No payment attempts."
                    rows={(student.payments || []).map((p) => (
                      <tr key={p.orderId}>
                        <td className="px-3 py-2 font-semibold text-[#22355E]">{p.courseTitle || '—'}</td>
                        <td className="px-3 py-2"><Pill value={p.status} /></td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatAmount(p.amountInPaise)}</td>
                        <td className="px-3 py-2 font-mono text-[10px] text-[#2B2B28]">
                          <span className="block">{p.razorpayOrderId}</span>
                          {p.razorpayPaymentId && <span className="block text-[#9B9690]">{p.razorpayPaymentId}</span>}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDate(p.createdAt)}</td>
                      </tr>
                    ))}
                  />
                </div>
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider font-bold text-[#9B9690] mb-1.5 flex items-center gap-1">
                    <Ticket className="w-3 h-3" aria-hidden="true" /> Coupons Used
                  </h4>
                  <Table
                    columns={['Code', 'Course', 'Discount', 'Used On']}
                    empty="No coupons redeemed."
                    rows={(student.couponRedemptions || []).map((c) => (
                      <tr key={`${c.code}-${c.usedAt}`}>
                        <td className="px-3 py-2 font-mono text-[#22355E]">{c.code}</td>
                        <td className="px-3 py-2">{c.courseTitle || '—'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatAmount(c.amountDiscountedInPaise)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDate(c.usedAt)}</td>
                      </tr>
                    ))}
                  />
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-[#9B9690]">Payment and coupon details need the payments.view permission.</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
