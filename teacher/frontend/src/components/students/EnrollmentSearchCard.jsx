import React, { useState } from 'react';
import { Search, Hash, User, Users, GraduationCap, Phone, Mail, ArrowUpRight, X } from 'lucide-react';
import { teacherApiService, ApiClientError } from '../../services/teacherApiService';

/**
 * Search Student, by enrollment number.
 *
 * Answers only for this teacher's own students. The backend decides that
 * against the roster, and a student outside it reads exactly like a number that
 * does not exist. The format check here only saves a round trip.
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

const initials = (name) =>
  String(name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

function Detail({ icon: Icon, label, value, mono = false }) {
  return (
    <div className="p-3 rounded-lg bg-[#F7F5EE] border border-[#DFDACB] min-w-0">
      <dt className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-[#6E6A64]">
        <Icon className="w-3 h-3" aria-hidden="true" />
        {label}
      </dt>
      <dd className={`mt-1 text-xs font-bold text-[#22355E] break-words ${mono ? 'font-mono' : ''}`}>
        {value || <span className="font-normal text-[#9B9690]">Not provided yet</span>}
      </dd>
    </div>
  );
}

export default function EnrollmentSearchCard({ onOpenProfile }) {
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
      setStudent(await teacherApiService.findStudentByEnrollmentNumber(enrollmentNumber));
      setStatus('found');
    } catch (err) {
      setStatus(err instanceof ApiClientError && err.status === 404 ? 'missing' : 'error');
      setMessage(err instanceof ApiClientError ? err.message : 'Search failed. Please try again.');
    }
  };

  const clear = () => {
    setQuery('');
    setStudent(null);
    setStatus('idle');
    setMessage('');
  };

  return (
    <section className="p-4 rounded-xl bg-[#FFFFFF] border border-[#DFDACB] space-y-4" aria-labelledby="enrollment-search-title">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 id="enrollment-search-title" className="text-sm font-bold text-[#22355E] font-display">
            Search Student
          </h2>
          <p className="text-[11px] text-[#6E6A64]">Find one of your students by their enrollment number.</p>
        </div>

        <form onSubmit={handleSearch} className="flex w-full md:w-auto items-center gap-2" role="search">
          <label htmlFor="enrollment-number-search" className="sr-only">
            Enrollment number
          </label>
          <div className="relative flex-1 md:w-72">
            <Hash className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#6E6A64]" aria-hidden="true" />
            <input
              id="enrollment-number-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter Enrollment Number, e.g. NN26-000124"
              autoComplete="off"
              spellCheck={false}
              maxLength={40}
              className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-lg pl-8 pr-3 py-1.5 text-xs font-mono text-[#2B2B28] placeholder-[#6E6A64] placeholder:font-sans focus:outline-none focus:border-[#22355E]"
            />
          </div>
          <button
            type="submit"
            disabled={status === 'loading'}
            className="px-3.5 py-1.5 rounded-lg bg-[#22355E] hover:bg-[#1A2A4A] disabled:opacity-60 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
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
            className={`p-3 rounded-lg text-xs border ${
              status === 'missing'
                ? 'bg-[#F7F5EE] border-[#DFDACB] text-[#6E6A64]'
                : 'bg-[#C1352B]/10 border-[#C1352B]/30 text-[#C1352B]'
            }`}
          >
            {message}
          </div>
        )}

        {status === 'found' && student && (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#22355E] text-white flex items-center justify-center text-xs font-bold shrink-0" aria-hidden="true">
                  {initials(student.fullName)}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-[#22355E] truncate">{student.fullName}</h3>
                  <p className="text-[11px] font-mono text-[#6E6A64]">{student.enrollmentNumber}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!student.profileComplete && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#AB5236]/10 text-[#AB5236] border border-[#AB5236]/30">
                    Profile incomplete
                  </span>
                )}
                <button type="button" onClick={clear} aria-label="Clear search" className="p-1 rounded-md text-[#6E6A64] hover:bg-[#F7F5EE] hover:text-[#22355E]">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              <Detail icon={Hash} label="Enrollment Number" value={student.enrollmentNumber} mono />
              <Detail icon={User} label="Full Name" value={student.fullName} />
              <Detail icon={Users} label="Parent/Guardian Name" value={student.guardianName} />
              <Detail icon={GraduationCap} label="Class" value={student.grade} />
              <Detail icon={Phone} label="Phone Number" value={formatPhone(student.phone)} />
              <Detail icon={Mail} label="Email" value={student.email} />
            </dl>

            <div>
              <h4 className="text-[10px] uppercase tracking-wider font-bold text-[#6E6A64] mb-1.5">Course Enrollments</h4>
              {student.enrollments?.length ? (
                <div className="overflow-x-auto rounded-lg border border-[#DFDACB]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F7F5EE] text-[#6E6A64]">
                      <tr>
                        <th scope="col" className="px-3 py-2 font-semibold">Course</th>
                        <th scope="col" className="px-3 py-2 font-semibold">Batch</th>
                        <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                        <th scope="col" className="px-3 py-2 font-semibold">Enrolled On</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DFDACB]">
                      {student.enrollments.map((e) => (
                        <tr key={e.enrollmentId || e.courseSlug}>
                          <td className="px-3 py-2 font-semibold text-[#22355E]">
                            {e.courseTitle || e.courseSlug}
                            {e.enrollmentId && <span className="block text-[10px] font-mono font-normal text-[#9B9690]">{e.enrollmentId}</span>}
                          </td>
                          <td className="px-3 py-2 text-[#2B2B28]">{e.batchCode || '—'}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${e.status === 'active' ? 'bg-[#5C7A5E]/10 text-[#5C7A5E]' : 'bg-[#C1352B]/10 text-[#C1352B]'}`}>
                              {e.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-[#2B2B28] whitespace-nowrap">{formatDate(e.enrolledAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-[#9B9690]">No course enrolment in your classes.</p>
              )}
            </div>

            {onOpenProfile && student.classes?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {student.classes.map((c) => (
                  <button
                    key={c.studentId}
                    type="button"
                    onClick={() => onOpenProfile(c.studentId)}
                    className="px-3 py-1.5 rounded-lg border border-[#DFDACB] hover:border-[#22355E] text-[11px] font-bold text-[#AB5236] flex items-center gap-1 transition-colors"
                  >
                    Open profile{c.className ? ` in ${c.className}` : ''} <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
