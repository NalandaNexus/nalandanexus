import React, { useState, useEffect, useCallback } from 'react';
import { Image, Plus, CheckCircle2, Upload, Trash2, FileText, Calendar, BookOpen, ExternalLink, AlertCircle } from 'lucide-react';
import EmptyState from '../components/common/EmptyState';
import { adminApi, SOCKET_URL } from '../services/adminApi';
import { useRealtimeEvents } from '../hooks/useRealtimeEvents';

const TYPES = [
  { value: 'all', label: 'All' },
  { value: 'magazine', label: 'Magazines', icon: BookOpen },
  { value: 'event', label: 'Event Photos', icon: Calendar },
  { value: 'program', label: 'Program Resources', icon: FileText },
];

const emptyForm = { title: '', description: '', type: 'magazine' };

export default function ResourcesPage() {
  const [typeFilter, setTypeFilter] = useState('all');
  const [resources, setResources] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [loadError, setLoadError] = useState('');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchResources = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const { items } = await adminApi.getResources({ limit: 100, ...(typeFilter !== 'all' ? { type: typeFilter } : {}) });
      setResources(items);
    } catch (err) {
      setLoadError(err.message || 'Failed to load resources.');
    } finally {
      setIsLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  useRealtimeEvents(['resource.created', 'resource.updated', 'resource.deleted'], fetchResources);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!file) {
      showToast('Please choose a file to upload.');
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await adminApi.createResource({ ...formData, file });
      showToast(
        result.meta?.catalogSync?.synced
          ? 'Uploaded and published live to the Landing Page.'
          : 'Uploaded, but publishing to the Landing Page failed — it will not appear publicly yet.'
      );
      setCreateModalOpen(false);
      setFormData(emptyForm);
      setFile(null);
      fetchResources();
    } catch (err) {
      showToast(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (resource) => {
    if (!window.confirm(`Delete "${resource.title}"? This removes it from the Landing Page immediately.`)) return;
    try {
      await adminApi.deleteResource(resource.id);
      showToast('Resource deleted.');
      fetchResources();
    } catch (err) {
      showToast(err.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-[#22355E] text-white border border-[#22355E] shadow-2xl flex items-center gap-3 max-w-sm">
          <CheckCircle2 className="w-5 h-5 text-[#5C7A5E] shrink-0" />
          <span className="text-xs font-semibold">{toastMsg}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#DFDACB]/80 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#22355E]">Resources</h1>
          <p className="text-xs text-[#9B9690] mt-1">
            Upload magazines, event photos, and program materials — published live to the public Landing Page.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-[#22355E] hover:bg-[#1A2A4A] text-white text-xs font-semibold transition-all shadow-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Upload Resource</span>
        </button>
      </div>

      <div className="flex items-center gap-2 bg-[#F7F5EE] p-1 rounded-xl border border-[#DFDACB] w-fit flex-wrap">
        {TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setTypeFilter(t.value)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
              typeFilter === t.value ? 'bg-white text-[#22355E] shadow-xs' : 'text-[#9B9690]'
            }`}
          >
            {t.icon && <t.icon className="w-3.5 h-3.5" />}
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-xs text-[#9B9690] space-y-2">
          <div className="w-6 h-6 border-2 border-[#22355E] border-t-transparent rounded-full animate-spin mx-auto" />
          <p>Loading resources...</p>
        </div>
      ) : loadError ? (
        <div className="bg-white border border-[#DFDACB] rounded-2xl p-8 text-center space-y-3">
          <AlertCircle className="w-6 h-6 text-[#AB5236] mx-auto" />
          <p className="text-xs text-[#2B2B28]">{loadError}</p>
          <button
            type="button"
            onClick={fetchResources}
            className="px-4 py-2 rounded-xl bg-[#22355E] hover:bg-[#1A2A4A] text-white text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      ) : resources.length === 0 ? (
        <div className="bg-white border border-[#DFDACB] rounded-2xl p-8">
          <EmptyState title="No resources yet" description="Magazines, event photos, and program materials you upload will appear here and on the public Landing Page." />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {resources.map((r) => (
            <div key={r.id} className="bg-white border border-[#DFDACB] rounded-2xl overflow-hidden shadow-card flex flex-col">
              {r.fileType?.startsWith('image/') ? (
                <img src={`${SOCKET_URL}${r.file}`} alt={r.title} className="w-full h-36 object-cover" />
              ) : (
                <div className="w-full h-36 bg-[#F7F5EE] flex items-center justify-center">
                  <FileText className="w-10 h-10 text-[#9B9690]" />
                </div>
              )}
              <div className="p-4 space-y-2 flex-1 flex flex-col">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#5C7A5E]/15 text-[#5C7A5E] border border-[#5C7A5E]/30 uppercase">
                    {r.type}
                  </span>
                  {r.catalogSyncStatus !== 'synced' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#AB5236]/15 text-[#AB5236] border border-[#AB5236]/30">
                      Not live
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-[#22355E] leading-snug">{r.title}</h3>
                {r.description && <p className="text-xs text-[#2B2B28]/70 leading-relaxed line-clamp-2">{r.description}</p>}
                <div className="mt-auto pt-2 border-t border-[#EDEAE0] flex items-center justify-between">
                  <a
                    href={`${SOCKET_URL}${r.file}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#22355E] hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" /> View file
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDelete(r)}
                    className="p-1.5 rounded-lg text-[#AB5236] hover:bg-[#AB5236]/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#22355E]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#DFDACB] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#22355E] flex items-center gap-2">
              <Image className="w-4 h-4" /> Upload Resource
            </h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#2B2B28] mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Annual Magazine 2026"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs text-[#2B2B28] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#2B2B28] mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3 py-2 text-xs text-[#2B2B28]"
                >
                  <option value="magazine">Magazine</option>
                  <option value="event">Event Photo</option>
                  <option value="program">Program Resource</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#2B2B28] mb-1">Description (optional)</label>
                <textarea
                  rows="2"
                  placeholder="Short description shown on the Landing Page..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2 text-xs text-[#2B2B28] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#2B2B28] mb-1">File (PDF or image, up to 20MB)</label>
                <label className="flex items-center gap-2 w-full bg-[#F7F5EE] border border-dashed border-[#DFDACB] rounded-xl px-3.5 py-3 text-xs text-[#9B9690] cursor-pointer hover:bg-[#EDEAE0] transition-colors">
                  <Upload className="w-4 h-4 shrink-0" />
                  <span className="truncate">{file ? file.name : 'Choose a file...'}</span>
                  <input
                    type="file"
                    required
                    accept="application/pdf,image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
              <div className="pt-3 border-t border-[#EDEAE0] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCreateModalOpen(false);
                    setFile(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#EDEAE0] text-xs font-semibold text-[#2B2B28]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-[#22355E] hover:bg-[#1A2A4A] text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload & Publish</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
