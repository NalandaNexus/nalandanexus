import React from 'react';
import { ShieldCheck } from 'lucide-react';

export default function AdminFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto py-6 px-6 border-t border-[#DFDACB] bg-[#EDEAE0] text-xs text-[#9B9690] flex flex-col sm:flex-row items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-[#22355E]">Nalanda Nexus</span>
        <span>—</span>
        <span>Institutional Governance Suite</span>
      </div>

      <div className="flex items-center gap-4 text-[11px]">
        <span>© {currentYear} Nalanda Nexus</span>
        <span>•</span>
        <span className="inline-flex items-center gap-1 text-[#5C7A5E] font-medium">
          <ShieldCheck className="w-3.5 h-3.5" /> Root Authority Active
        </span>
      </div>
    </footer>
  );
}
