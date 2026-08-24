import React from 'react';

export function StatCardSkeleton() {
  return (
    <div className="p-5 rounded-2xl bg-[#FFFFFF] border border-[#DFDACB] animate-pulse space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-4 w-24 bg-[#F7F5EE] rounded" />
        <div className="w-8 h-8 rounded-xl bg-[#F7F5EE]" />
      </div>
      <div className="h-8 w-20 bg-[#F7F5EE] rounded" />
      <div className="h-3 w-32 bg-[#F7F5EE] rounded" />
    </div>
  );
}

export const StatSkeleton = StatCardSkeleton;

export function AlertStripSkeleton() {
  return (
    <div className="p-5 rounded-2xl bg-[#FFFFFF] border border-[#DFDACB] animate-pulse space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-5 w-44 bg-[#F7F5EE] rounded" />
        <div className="h-4 w-28 bg-[#F7F5EE] rounded" />
      </div>
      <div className="space-y-2">
        <div className="h-16 w-full bg-[#F7F5EE] rounded-xl border border-[#DFDACB]" />
        <div className="h-16 w-full bg-[#F7F5EE] rounded-xl border border-[#DFDACB]" />
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="p-6 rounded-2xl bg-[#FFFFFF] border border-[#DFDACB] animate-pulse space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-5 w-48 bg-[#F7F5EE] rounded" />
        <div className="h-7 w-32 bg-[#F7F5EE] rounded-lg" />
      </div>
      <div className="h-64 w-full bg-[#F7F5EE] rounded-xl border border-[#DFDACB]" />
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="p-6 rounded-2xl bg-[#FFFFFF] border border-[#DFDACB] animate-pulse space-y-4">
      <div className="h-5 w-48 bg-[#F7F5EE] rounded" />
      <div className="space-y-2">
        <div className="h-10 w-full bg-[#F7F5EE] rounded" />
        <div className="h-10 w-full bg-[#F7F5EE] rounded" />
        <div className="h-10 w-full bg-[#F7F5EE] rounded" />
      </div>
    </div>
  );
}
