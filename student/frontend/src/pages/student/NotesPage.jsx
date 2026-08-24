import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Search, Trash2, Edit3, Save, FileText, Check, Download, FolderOpen } from 'lucide-react';
import { useStudent } from '../../context/StudentContext';
import { studentApiService } from '../../services/studentApiService';

function formatFileSize(bytes) {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function CourseMaterialsSection() {
  const [materials, setMaterials] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    studentApiService
      .getMaterials()
      .then((data) => {
        if (!cancelled) setMaterials(data);
      })
      .catch(() => {
        if (!cancelled) setMaterials([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) return null;
  if (materials.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FolderOpen className="w-4 h-4 text-[#22355E]" />
        <h2 className="font-heading font-bold text-sm text-[#22355E]">Course Materials from Your Teacher</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {materials.map((m) => (
          <a
            key={m._id}
            href={m.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="p-4 rounded-2xl bg-white border border-[#DFDACB] hover:border-[#22355E]/40 shadow-xs flex items-start justify-between gap-3 transition-colors"
          >
            <div className="min-w-0">
              <span className="text-[10px] font-bold font-data text-[#22355E] uppercase bg-[#22355E]/10 px-2 py-0.5 rounded">
                {m.fileType}
              </span>
              <h3 className="font-heading font-bold text-xs text-[#22355E] mt-1.5 leading-tight truncate">{m.title}</h3>
              <p className="text-[10px] text-[#2B2B28]/60 mt-1">
                {m.uploadedByName ? `${m.uploadedByName} · ` : ''}
                {new Date(m.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {m.fileSizeBytes ? ` · ${formatFileSize(m.fileSizeBytes)}` : ''}
              </p>
            </div>
            <Download className="w-4 h-4 text-[#2B2B28]/40 shrink-0 mt-0.5" />
          </a>
        ))}
      </div>
    </div>
  );
}

export default function NotesPage() {
  const { notes, saveNote, deleteNote } = useStudent();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Mindset');
  const [newContent, setNewContent] = useState('');

  const categories = ['All', 'Mindset', 'Communication', 'Productivity', 'General'];

  const filteredNotes = notes.filter((n) => {
    const matchesCat = selectedCategory === 'All' || n.category === selectedCategory;
    const matchesSearch =
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleCreateNote = (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    saveNote({
      title: newTitle,
      category: newCategory,
      content: newContent,
    });

    setNewTitle('');
    setNewContent('');
    setIsCreating(false);
  };

  return (
    <div className="w-full min-h-screen bg-[#EDEAE0] p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Header & Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <Link
              to="/student/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#22355E] hover:text-[#AB5236] transition-colors mb-1"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </Link>
            <h1 className="font-display font-bold text-xl sm:text-2xl text-[#22355E]">
              My Study Notes & Insights
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="px-4 py-2.5 bg-[#AB5236] hover:bg-[#92422a] text-white font-heading font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 w-fit min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span>New Study Note</span>
          </button>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#FAF9F4] p-3.5 rounded-2xl border border-[#DFDACB]">
          {/* Search */}
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your notes..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#DFDACB] rounded-xl text-[#2B2B28] placeholder-[#2B2B28]/40 focus:outline-none focus:ring-2 focus:ring-[#22355E]"
            />
            <Search className="w-4 h-4 text-[#2B2B28]/40 absolute left-3 top-2.5" />
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 student-focus ${
                  selectedCategory === cat
                    ? 'bg-[#22355E] text-white font-bold'
                    : 'bg-white hover:bg-[#EDEAE0] border border-[#DFDACB] text-[#2B2B28]/80'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <CourseMaterialsSection />

        <h2 className="font-heading font-bold text-sm text-[#22355E] pt-2">My Personal Notes</h2>

        {/* New Note Creator Modal / Form */}
        {isCreating && (
          <form
            onSubmit={handleCreateNote}
            className="p-5 rounded-2xl bg-[#FAF9F4] border-2 border-[#AB5236] shadow-md space-y-4 animate-in fade-in duration-150"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-sm text-[#22355E]">Create Study Note</h3>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-xs text-[#2B2B28]/60 hover:text-[#2B2B28]"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="Note Title..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  className="w-full p-2.5 bg-white border border-[#DFDACB] rounded-xl text-xs font-bold text-[#22355E]"
                />
              </div>
              <div>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#DFDACB] rounded-xl text-xs text-[#2B2B28]"
                >
                  <option value="Mindset">Mindset</option>
                  <option value="Communication">Communication</option>
                  <option value="Productivity">Productivity</option>
                  <option value="General">General</option>
                </select>
              </div>
            </div>

            <textarea
              rows={4}
              placeholder="Write your notes, concepts, and key takeaways here..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              required
              className="w-full p-3 bg-white border border-[#DFDACB] rounded-xl text-xs text-[#2B2B28] leading-relaxed"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 bg-white border border-[#DFDACB] text-xs font-semibold rounded-xl text-[#2B2B28]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#AB5236] hover:bg-[#92422a] text-white font-heading font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Note</span>
              </button>
            </div>
          </form>
        )}

        {/* Notes Grid */}
        {filteredNotes.length === 0 ? (
          <div className="p-12 text-center bg-[#FAF9F4] rounded-2xl border border-[#DFDACB]">
            <FileText className="w-8 h-8 text-[#2B2B28]/30 mx-auto mb-2" />
            <p className="text-sm font-semibold text-[#22355E]">No notes found in this category.</p>
            <p className="text-xs text-[#2B2B28]/60 mt-1">Create one to capture your lecture insights!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredNotes.map((note) => (
              <div
                key={note.id}
                className="p-4 rounded-2xl bg-[#FAF9F4] border border-[#DFDACB] hover:border-[#22355E]/40 shadow-xs flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[10px] font-bold font-data text-[#AB5236] uppercase bg-[#AB5236]/10 px-2 py-0.5 rounded">
                      {note.category}
                    </span>
                    <span className="text-[10px] font-data text-[#2B2B28]/50">
                      {note.updatedAt}
                    </span>
                  </div>
                  <h3 className="font-heading font-bold text-sm text-[#22355E] mb-2 leading-tight">
                    {note.title}
                  </h3>
                  <p className="text-xs text-[#2B2B28]/80 leading-relaxed line-clamp-4">
                    {note.content}
                  </p>
                </div>

                <div className="pt-2 border-t border-[#DFDACB]/60 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Delete "${note.title}"? This cannot be undone.`)) deleteNote(note.id);
                    }}
                    className="p-1.5 text-[#2B2B28]/50 hover:text-[#AB5236] rounded-lg hover:bg-black/5 transition-colors"
                    title="Delete Note"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
