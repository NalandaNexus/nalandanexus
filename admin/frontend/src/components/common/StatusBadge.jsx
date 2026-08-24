import React from 'react';
import { CheckCircle2, Clock, Ban, Archive, AlertCircle, AlertTriangle, ShieldAlert } from 'lucide-react';

const STATUS_CONFIGS = {
  // Good status: #5C7A5E
  ACTIVE: {
    label: 'Active',
    bg: 'bg-[#5C7A5E]/15',
    text: 'text-[#5C7A5E]',
    border: 'border-[#5C7A5E]/30',
    dot: 'bg-[#5C7A5E]',
    Icon: CheckCircle2,
  },
  HEALTHY: {
    label: 'Healthy',
    bg: 'bg-[#5C7A5E]/15',
    text: 'text-[#5C7A5E]',
    border: 'border-[#5C7A5E]/30',
    dot: 'bg-[#5C7A5E]',
    Icon: CheckCircle2,
  },
  APPROVED: {
    label: 'Approved',
    bg: 'bg-[#5C7A5E]/15',
    text: 'text-[#5C7A5E]',
    border: 'border-[#5C7A5E]/30',
    dot: 'bg-[#5C7A5E]',
    Icon: CheckCircle2,
  },
  COMPLETED: {
    label: 'Completed',
    bg: 'bg-[#5C7A5E]/15',
    text: 'text-[#5C7A5E]',
    border: 'border-[#5C7A5E]/30',
    dot: 'bg-[#5C7A5E]',
    Icon: CheckCircle2,
  },

  // Attention status: #C99A2E
  INVITED: {
    label: 'Invited',
    bg: 'bg-[#C99A2E]/15',
    text: 'text-[#C99A2E]',
    border: 'border-[#C99A2E]/30',
    dot: 'bg-[#C99A2E]',
    Icon: Clock,
  },
  PENDING: {
    label: 'Pending',
    bg: 'bg-[#C99A2E]/15',
    text: 'text-[#C99A2E]',
    border: 'border-[#C99A2E]/30',
    dot: 'bg-[#C99A2E]',
    Icon: Clock,
  },
  PENDING_REVIEW: {
    label: 'Pending Review',
    bg: 'bg-[#C99A2E]/15',
    text: 'text-[#C99A2E]',
    border: 'border-[#C99A2E]/30',
    dot: 'bg-[#C99A2E]',
    Icon: AlertTriangle,
  },
  EXPIRING: {
    label: 'Expiring Soon',
    bg: 'bg-[#C99A2E]/15',
    text: 'text-[#C99A2E]',
    border: 'border-[#C99A2E]/30',
    dot: 'bg-[#C99A2E]',
    Icon: AlertCircle,
  },

  // Blocked status: #C1352B
  SUSPENDED: {
    label: 'Suspended',
    bg: 'bg-[#C1352B]/15',
    text: 'text-[#C1352B]',
    border: 'border-[#C1352B]/30',
    dot: 'bg-[#C1352B]',
    Icon: Ban,
  },
  FAILED: {
    label: 'Failed',
    bg: 'bg-[#C1352B]/15',
    text: 'text-[#C1352B]',
    border: 'border-[#C1352B]/30',
    dot: 'bg-[#C1352B]',
    Icon: AlertCircle,
  },
  CRITICAL: {
    label: 'Critical',
    bg: 'bg-[#C1352B]/15',
    text: 'text-[#C1352B]',
    border: 'border-[#C1352B]/30',
    dot: 'bg-[#C1352B]',
    Icon: ShieldAlert,
  },

  // Neutral status: #9B9690
  INACTIVE: {
    label: 'Inactive',
    bg: 'bg-[#9B9690]/15',
    text: 'text-[#9B9690]',
    border: 'border-[#9B9690]/30',
    dot: 'bg-[#9B9690]',
    Icon: Archive,
  },
  ARCHIVED: {
    label: 'Archived',
    bg: 'bg-[#9B9690]/15',
    text: 'text-[#9B9690]',
    border: 'border-[#9B9690]/30',
    dot: 'bg-[#9B9690]',
    Icon: Archive,
  },
};

export default function StatusBadge({ status, customLabel, size = 'sm', showIcon = true }) {
  const normalized = (status || 'INACTIVE').toUpperCase().replace(/\s+/g, '_');
  const config = STATUS_CONFIGS[normalized] || STATUS_CONFIGS.INACTIVE;
  const { Icon } = config;
  const label = customLabel || config.label;

  const sizeClasses =
    size === 'xs'
      ? 'px-2 py-0.5 text-[11px] gap-1'
      : size === 'lg'
      ? 'px-3 py-1.5 text-sm gap-2'
      : 'px-2.5 py-1 text-xs gap-1.5';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-md border ${config.bg} ${config.text} ${config.border} ${sizeClasses} whitespace-nowrap`}
    >
      {showIcon && Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
      <span>{label}</span>
    </span>
  );
}
