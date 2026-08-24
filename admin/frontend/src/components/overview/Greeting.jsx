import React from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { Calendar, ShieldCheck } from 'lucide-react';

export default function Greeting() {
  const { getFirstName } = useAdminAuth();
  const firstName = getFirstName();

  const getGreetingTime = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#DFDACB]/60">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl text-[#22355E] tracking-tight font-normal">
          {getGreetingTime()}, {firstName} <span className="inline-block animate-wave">👋</span>
        </h1>
        <p className="text-xs text-[#9B9690] mt-1">
          Everything important across the Nalanda Nexus campus ecosystem is under control.
        </p>
      </div>

      <div className="flex items-center gap-2 text-xs text-[#22355E] bg-white px-3.5 py-2 rounded-xl border border-[#DFDACB] shadow-sm self-start sm:self-auto font-medium">
        <Calendar className="w-3.5 h-3.5 text-[#AB5236]" />
        <span>{formattedDate}</span>
      </div>
    </div>
  );
}
