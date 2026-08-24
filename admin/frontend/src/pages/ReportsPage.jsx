import React, { useState } from 'react';
import { FileDown, Users, GraduationCap, Shield, BookOpen, IndianRupee, ClipboardList, AlertCircle } from 'lucide-react';
import { adminApi } from '../services/adminApi';

export default function ReportsPage() {
  const [downloadingType, setDownloadingType] = useState(null);
  const [errorByType, setErrorByType] = useState({});

  const reports = [
    {
      title: 'Faculty & Teacher Master Report',
      description: 'Complete roster of verified faculty, subject allocations, invitation lifecycle states, and contact coordinates.',
      type: 'teachers',
      icon: GraduationCap,
      format: 'CSV (Spreadsheet Compatible)',
    },
    {
      title: 'Student Enrollment & Academic Roster',
      description: 'Full database export of enrolled students, GPA metrics, cohort batches, and attendance adherence percentages.',
      type: 'students',
      icon: Users,
      format: 'CSV (Spreadsheet Compatible)',
    },
    {
      title: 'Course Catalog & Governance Report',
      description: 'Every course record with commerce fields, governance status, instructor assignment, and student catalog sync state.',
      type: 'courses',
      icon: BookOpen,
      format: 'CSV (Spreadsheet Compatible)',
    },
    {
      title: 'Payments & Razorpay Transactions Report',
      description: 'Full payment ledger including manually recorded fees and real, signature-verified Razorpay course purchases.',
      type: 'payments',
      icon: IndianRupee,
      format: 'CSV (Spreadsheet Compatible)',
    },
    {
      title: 'Course Enrollment Report',
      description: 'Every student-course enrollment record with progress percentage, status, and completion timestamps.',
      type: 'enrollments',
      icon: ClipboardList,
      format: 'CSV (Spreadsheet Compatible)',
    },
    {
      title: 'System Security & Governance Audit Trail',
      description: 'Cryptographically ordered activity log records of all administrative actions, permission grants, and account states.',
      type: 'audit',
      icon: Shield,
      format: 'CSV (Spreadsheet Compatible)',
    },
  ];

  const handleDownload = async (type) => {
    setDownloadingType(type);
    setErrorByType((prev) => ({ ...prev, [type]: null }));
    try {
      await adminApi.downloadReport(type);
    } catch (err) {
      setErrorByType((prev) => ({ ...prev, [type]: err.message || 'Download failed.' }));
    } finally {
      setDownloadingType(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="border-b border-[#DFDACB]/80 pb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-[#22355E]">Institutional Report Generator</h1>
        <p className="text-xs text-[#9B9690] mt-1">
          Export institutional datasets for NAAC/UGC regulatory accreditation, financial auditing, and academic councils.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {reports.map((r) => {
          const Icon = r.icon;
          const isDownloading = downloadingType === r.type;
          const error = errorByType[r.type];

          return (
            <div
              key={r.type}
              className="bg-white border border-[#DFDACB] rounded-2xl p-6 shadow-card hover:shadow-hover transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-[#22355E]/10 border border-[#22355E]/30 text-[#22355E] flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-[#22355E]">{r.title}</h3>
                <p className="text-xs text-[#2B2B28] leading-relaxed">{r.description}</p>
              </div>

              <div className="pt-3 border-t border-[#EDEAE0] space-y-3">
                <span className="text-[11px] font-mono text-[#9B9690] block">{r.format}</span>
                {error && (
                  <p className="text-[11px] text-[#C1352B] flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
                  </p>
                )}
                <button
                  type="button"
                  disabled={isDownloading}
                  onClick={() => handleDownload(r.type)}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#22355E] hover:bg-[#1A2A4A] disabled:opacity-60 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  {isDownloading ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <FileDown className="w-4 h-4" />
                      <span>Download Report (.csv)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
