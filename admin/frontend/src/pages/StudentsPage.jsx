import React, { useState, useEffect } from 'react';
import { Search, UserPlus, FileDown, MoreVertical, Trash2, Edit, CheckCircle2, ShieldAlert } from 'lucide-react';
import StatusBadge from '../components/common/StatusBadge';
import EmptyState from '../components/common/EmptyState';
import DeleteModal from '../components/common/DeleteModal';
import { adminApi } from '../services/adminApi';
import { useRealtimeEvents } from '../hooks/useRealtimeEvents';
import EnrollmentLookup from '../components/students/EnrollmentLookup';

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', department: 'ALL', batch: 'ALL' });
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);

  // New Student Form
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    rollNo: '',
    batch: '',
    department: 'Computer Science',
  });

  const showToast = (msg, type = 'success') => {
    setToastMsg({ msg, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const handleExportCsv = async () => {
    setIsExportingCsv(true);
    try {
      await adminApi.downloadReport('students');
    } catch (err) {
      showToast(err.message || 'Export failed.', 'error');
    } finally {
      setIsExportingCsv(false);
    }
  };

  // Derived from whatever's currently loaded (real values, never a
  // hardcoded list) - narrows to the active filter's result set rather than
  // a separate "all distinct batches" endpoint, so it can shrink once a
  // batch is selected; "All Batches" always resets it back to the full set.
  const batchOptions = [...new Set(students.map((s) => s.batch).filter(Boolean))].sort();

  const fetchStudents = async () => {
    try {
      setIsLoading(true);
      const query = { ...filters, limit: 100 };
      if (query.department === 'ALL') delete query.department;
      if (query.batch === 'ALL') delete query.batch;
      const data = await adminApi.getStudents(query);
      setStudents(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [filters]);

  useRealtimeEvents(['student.created', 'student.updated', 'student.deleted'], () => {
    fetchStudents();
  });

  const handleAddStudent = async (e) => {
    e.preventDefault();
    try {
      await adminApi.createStudent(formData);
      showToast(`Student ${formData.name} enrolled successfully!`);
      setAddModalOpen(false);
      setFormData({ name: '', email: '', rollNo: '', batch: '', department: 'Computer Science' });
      fetchStudents();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!studentToDelete) return;
    try {
      await adminApi.deleteStudent(studentToDelete.id);
      showToast(`Student record removed.`);
      setDeleteModalOpen(false);
      setStudentToDelete(null);
      fetchStudents();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-[#22355E] text-white border border-[#22355E] shadow-2xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-[#5C7A5E]" />
          <span className="text-xs font-semibold">{toastMsg.msg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#DFDACB]/80 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#22355E]">Student Records & Enrollment</h1>
          <p className="text-xs text-[#9B9690] mt-1">
            Browse institutional student roster, track GPA metrics, attendance adherence, and enrollments.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={isExportingCsv}
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-xl bg-white border border-[#DFDACB] hover:bg-[#EDEAE0] disabled:opacity-60 text-xs font-semibold text-[#22355E] transition-colors flex items-center gap-1.5 shadow-sm"
          >
            {isExportingCsv ? (
              <span className="w-3.5 h-3.5 border-2 border-[#22355E]/30 border-t-[#22355E] rounded-full animate-spin" />
            ) : (
              <FileDown className="w-3.5 h-3.5" />
            )}
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-[#22355E] hover:bg-[#1A2A4A] text-white text-xs font-semibold transition-all shadow-sm flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>Enroll Student</span>
          </button>
        </div>
      </div>

      {/* Portal students, by the enrollment number the student service issues */}
      <EnrollmentLookup />

      {/* Search & Filter Toolbar */}
      <div className="bg-white border border-[#DFDACB] rounded-2xl p-4 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9B9690]" />
          <input
            type="text"
            placeholder="Search students by name, email, or Roll Number..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl pl-10 pr-4 py-2 text-xs text-[#2B2B28] placeholder-[#9B9690] focus:outline-none focus:border-[#22355E]"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filters.department}
            onChange={(e) => setFilters({ ...filters, department: e.target.value })}
            className="bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3 py-2 text-xs font-semibold text-[#22355E] focus:outline-none"
          >
            <option value="ALL">All Departments</option>
            <option value="Computer Science">Computer Science</option>
            <option value="Computer Applications">Computer Applications</option>
            <option value="Physics">Physics</option>
            <option value="Mathematics">Mathematics</option>
            <option value="Electrical Engineering">Electrical Engineering</option>
          </select>
          <select
            value={filters.batch}
            onChange={(e) => setFilters({ ...filters, batch: e.target.value })}
            className="bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3 py-2 text-xs font-semibold text-[#22355E] focus:outline-none"
          >
            <option value="ALL">All Batches</option>
            {batchOptions.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white border border-[#DFDACB] rounded-2xl shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-[#9B9690] space-y-2">
            <div className="w-6 h-6 border-2 border-[#22355E] border-t-transparent rounded-full animate-spin mx-auto" />
            <p>Loading student records...</p>
          </div>
        ) : students.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No students found"
              description="No student records match your query."
              actionText="Clear Filters"
              onAction={() => setFilters({ search: '', department: 'ALL', batch: 'ALL' })}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F5EE] border-b border-[#DFDACB] text-[#9B9690] font-semibold">
                <tr>
                  <th className="py-3 px-4">Student & Roll No</th>
                  <th className="py-3 px-4">Department & Batch</th>
                  <th className="py-3 px-4">Attendance</th>
                  <th className="py-3 px-4 font-mono">GPA</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 font-mono">Last Active</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDEAE0] text-[#2B2B28]">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-[#F7F5EE]/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-[#22355E]">{student.name}</p>
                      <p className="text-[10px] font-mono text-[#9B9690]">{student.rollNo} • {student.email}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-[#22355E]">{student.department || '—'}</p>
                      <p className="text-[10px] text-[#9B9690]">{student.batch || '—'}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-bold text-[#5C7A5E] bg-[#5C7A5E]/10 px-2 py-0.5 rounded">
                        {(student.attendancePercent ?? 0).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-[#22355E]">
                      {(student.gpa ?? 0).toFixed(1)} / 10
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={student.status || 'ACTIVE'} size="xs" />
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-[#9B9690]">
                      {student.lastActive ? new Date(student.lastActive).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setStudentToDelete(student);
                          setDeleteModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-[#9B9690] hover:text-[#C1352B] hover:bg-[#C1352B]/10 transition-colors"
                        title="Delete Student"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="p-4 bg-[#F7F5EE] border-t border-[#DFDACB] text-xs text-[#9B9690] flex justify-between">
          <span>Institutional Student Database</span>
          <span className="font-mono font-bold text-[#22355E]">Total: {students.length} Enrolled</span>
        </div>
      </div>

      {/* Add Student Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#22355E]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#DFDACB] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#22355E]">Enroll New Student</h3>
            <form onSubmit={handleAddStudent} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#2B2B28] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tanvi Desai"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs text-[#2B2B28] focus:outline-none focus:border-[#22355E]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#2B2B28] mb-1">Official Student Email</label>
                <input
                  type="email"
                  required
                  placeholder="tanvi@nalanda.edu"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs text-[#2B2B28] focus:outline-none focus:border-[#22355E]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-[#2B2B28] mb-1">Roll Number</label>
                  <input
                    type="text"
                    required
                    placeholder="2026-CSE-101"
                    value={formData.rollNo}
                    onChange={(e) => setFormData({ ...formData, rollNo: e.target.value })}
                    className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3 py-2 text-xs font-mono text-[#2B2B28]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#2B2B28] mb-1">Department</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3 py-2 text-xs text-[#2B2B28]"
                  >
                    <option value="Computer Science">Computer Science</option>
                    <option value="Computer Applications">Computer Applications</option>
                    <option value="Physics">Physics</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Electrical Engineering">Electrical Engineering</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#2B2B28] mb-1">Batch</label>
                <input
                  type="text"
                  placeholder="2026"
                  value={formData.batch}
                  onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                  className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs text-[#2B2B28]"
                />
              </div>
              <div className="pt-3 border-t border-[#EDEAE0] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#EDEAE0] text-xs font-semibold text-[#2B2B28]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#22355E] hover:bg-[#1A2A4A] text-white text-xs font-semibold"
                >
                  Enroll Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Student Modal */}
      <DeleteModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Student Record?"
        description="This will deactivate the student account. Academic history is preserved, not erased."
        itemName={studentToDelete ? `${studentToDelete.name} (${studentToDelete.rollNo})` : ''}
      />
    </div>
  );
}
