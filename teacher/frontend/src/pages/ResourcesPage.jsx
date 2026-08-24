import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, Upload, Download, Trash2, X } from 'lucide-react';
import { teacherApiService, ApiClientError } from '../services/teacherApiService';

export default function ResourcesPage() {
  const [resources, setResources] = useState([]);
  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [form, setForm] = useState({ title: '', subject: '', classId: '' });
  const [file, setFile] = useState(null);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const fetchResources = useCallback(async () => {
    try {
      setError(null);
      const data = await teacherApiService.getResources();
      setResources(data || []);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load resources.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResources();
    teacherApiService.getClasses().then(setClasses).catch(() => {});
  }, [fetchResources]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !file) {
      setFormError('Title and a file are required.');
      return;
    }
    setIsSubmitting(true);
    setFormError('');
    try {
      await teacherApiService.uploadResource(form, file);
      setUploadOpen(false);
      setForm({ title: '', subject: '', classId: '' });
      setFile(null);
      fetchResources();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : 'Failed to upload resource.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async (res) => {
    try {
      const updated = await teacherApiService.downloadResource(res.id);
      window.open(teacherApiService.resolveFileUrl(res.fileUrl), '_blank');
      setResources((prev) => prev.map((r) => (r.id === res.id ? { ...r, downloads: updated.downloads } : r)));
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : 'Failed to download.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this resource? This cannot be undone.')) return;
    try {
      await teacherApiService.deleteResource(id);
      fetchResources();
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : 'Failed to delete.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#22355E] font-display">Faculty Resource Repository</h1>
          <p className="text-xs text-[#6E6A64] mt-1">Upload lecture slides, formula sheets, and study guides — real students in linked classes receive them instantly.</p>
        </div>
        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          className="flex items-center gap-2 bg-[#AB5236] hover:bg-[#94452C] text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-cta"
        >
          <Upload className="w-4 h-4" /> Upload Material
        </button>
      </div>

      {error && <div className="p-3.5 rounded-xl bg-[#C1352B]/10 border border-[#C1352B]/30 text-[#C1352B] text-xs">{error}</div>}

      {isLoading ? (
        <div className="p-8 text-center text-xs text-[#9B9690] bg-white rounded-2xl border border-[#DFDACB]">Loading…</div>
      ) : resources.length === 0 ? (
        <div className="p-8 text-center text-xs text-[#9B9690] bg-white rounded-2xl border border-[#DFDACB]">No resources uploaded yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {resources.map((res) => (
            <div key={res.id} className="p-5 rounded-2xl bg-[#FFFFFF] border border-[#DFDACB] space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#F7F5EE] border border-[#DFDACB] flex items-center justify-center text-[#22355E]">
                <FileText className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-[#22355E]">{res.title}</h4>
              <div className="flex items-center justify-between text-xs text-[#6E6A64]">
                <span className="uppercase">{res.type}</span>
                <span>{res.sizeLabel}</span>
              </div>
              <div className="pt-3 border-t border-[#DFDACB] flex justify-between items-center">
                <button onClick={() => handleDelete(res.id)} className="text-[#C1352B] hover:text-[#99241B]"><Trash2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDownload(res)} className="text-xs font-bold text-[#AB5236] hover:underline flex items-center gap-1">
                  <Download className="w-3.5 h-3.5" /> Download ({res.downloads})
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {uploadOpen && (
        <div className="fixed inset-0 z-50 bg-[#22355E]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#DFDACB] rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button onClick={() => setUploadOpen(false)} className="absolute right-4 top-4 p-1.5 rounded-lg text-[#9B9690] hover:bg-[#EDEAE0]"><X className="w-4 h-4" /></button>
            <h3 className="text-base font-bold text-[#22355E] mb-4">Upload Material</h3>
            <form onSubmit={handleUpload} className="space-y-3">
              {formError && <div className="p-2.5 rounded-xl bg-[#C1352B]/10 border border-[#C1352B]/30 text-[#C1352B] text-xs">{formError}</div>}
              <div>
                <label className="block text-xs font-semibold mb-1">Title *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Subject</label>
                <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Class (optional — links to student portal if course-linked)</label>
                <select value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })} className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs">
                  <option value="">No class</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">File *</label>
                <input ref={fileInputRef} type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full text-xs" />
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setUploadOpen(false)} className="px-4 py-2 rounded-xl bg-[#EDEAE0] hover:bg-[#DFDACB] text-xs font-semibold">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 rounded-xl bg-[#AB5236] hover:bg-[#94452C] text-white text-xs font-bold disabled:opacity-60">
                  {isSubmitting ? 'Uploading…' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
