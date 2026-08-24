import React, { useEffect, useRef } from 'react';
import { Search, X, User, Layers, BookOpen, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function GlobalSearchModal({
  isOpen,
  onOpen,
  onClose,
  searchQuery,
  setSearchQuery,
  searchResults,
  onSelectStudent,
}) {
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else onOpen?.();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onOpen]);

  if (!isOpen) return null;

  const handleSelectResult = (item) => {
    onClose();
    if (item.type === 'student') {
      if (onSelectStudent) onSelectStudent(item.data);
      else navigate('/students');
    } else if (item.type === 'class') {
      navigate('/classes');
    } else if (item.type === 'concept') {
      navigate('/grading');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#22355E]/60 backdrop-blur-xs flex items-start justify-center p-4 sm:p-6 pt-20 animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-[#FFFFFF] border border-[#DFDACB] rounded-2xl shadow-dropdown overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="p-4 border-b border-[#DFDACB] flex items-center gap-3 bg-[#F7F5EE]">
          <Search className="w-5 h-5 text-[#22355E] flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search students, classes, concepts, assignments..."
            className="w-full bg-transparent text-sm text-[#2B2B28] placeholder-[#6E6A64] focus:outline-none font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="p-1 rounded-lg text-[#6E6A64] hover:text-[#2B2B28]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search Results List */}
        <div className="max-h-96 overflow-y-auto p-2 divide-y divide-[#DFDACB]/50">
          {searchResults && searchResults.length > 0 ? (
            searchResults.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                onClick={() => handleSelectResult(item)}
                className="p-3 rounded-xl hover:bg-[#F7F5EE] cursor-pointer flex items-center justify-between transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-[#F7F5EE] group-hover:bg-[#FFFFFF] border border-[#DFDACB] flex items-center justify-center text-[#22355E] flex-shrink-0">
                    {item.type === 'student' && <User className="w-4 h-4" />}
                    {item.type === 'class' && <Layers className="w-4 h-4" />}
                    {item.type === 'concept' && <BookOpen className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-[#22355E] group-hover:text-[#AB5236] transition-colors truncate">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-[#6E6A64] truncate">{item.subtitle}</p>
                  </div>
                </div>

                <ArrowUpRight className="w-4 h-4 text-[#6E6A64] group-hover:text-[#AB5236] transition-colors flex-shrink-0" />
              </div>
            ))
          ) : searchQuery ? (
            <div className="p-8 text-center text-xs text-[#6E6A64]">
              No results found for &ldquo;{searchQuery}&rdquo;. Try another term.
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-[#6E6A64]">
              Type student name, class code, or syllabus topic to search...
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2.5 bg-[#F7F5EE] border-t border-[#DFDACB] flex items-center justify-between text-[11px] text-[#6E6A64]">
          <span>Navigate with ↑ ↓ and Press ESC to close</span>
          <span className="font-mono">Nalanda Nexus Search</span>
        </div>
      </div>
    </div>
  );
}
