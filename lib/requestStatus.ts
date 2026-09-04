import type { RequestStatusValue } from '@/types';
import { parseLocalDate } from '@/lib/holidayCalculator';

interface RequestStatusMeta {
  label: string;
  /** Pill badge (modal header, dashboard history, admin requests list). */
  badge: string;
  /**
   * Calendar chip. Each status must be distinguishable without colour:
   * pending = dashed border, approved = solid fill, denied = strikethrough + solid border,
   * cancelled = strikethrough + italic. All text/background pairs are ≥ 4.5:1.
   */
  chip: string;
  /** Legend swatch. */
  swatch: string;
}

export const REQUEST_STATUS_META: Record<RequestStatusValue, RequestStatusMeta> = {
  REQUESTED: {
    label: 'Pending',
    badge: 'bg-orange-100 text-orange-700',
    chip: 'bg-orange-50 text-orange-800 border border-dashed border-orange-400 hover:bg-orange-100',
    swatch: 'bg-orange-50 border border-dashed border-orange-400',
  },
  APPROVED: {
    label: 'Approved',
    badge: 'bg-green-100 text-green-700',
    chip: 'bg-[#0041F0] text-white hover:bg-blue-700',
    swatch: 'bg-[#0041F0]',
  },
  DENIED: {
    label: 'Denied',
    badge: 'bg-red-100 text-red-700',
    chip: 'bg-red-50 text-red-700 line-through border border-red-300 hover:bg-red-100',
    swatch: 'bg-red-50 border border-red-300',
  },
  CANCELLED: {
    label: 'Cancelled',
    badge: 'bg-slate-100 text-slate-600',
    chip: 'bg-slate-100 text-slate-600 line-through italic hover:bg-slate-200',
    swatch: 'bg-slate-100 border border-slate-300',
  },
};

export const ALL_REQUEST_STATUSES = Object.keys(REQUEST_STATUS_META) as RequestStatusValue[];

/** Render order inside a calendar cell: actionable/real absences first, ghosts last. */
export const REQUEST_STATUS_PRIORITY: Record<RequestStatusValue, number> = {
  APPROVED: 0,
  REQUESTED: 1,
  DENIED: 2,
  CANCELLED: 3,
};

/**
 * Statuses that count towards the "multiple people away" warning.
 * Unchanged from before this feature: approved leave only.
 */
export const OVERLAP_STATUSES: readonly RequestStatusValue[] = ['APPROVED'];

/** "Jul 6, 2026" from an ISO date string, by calendar date (not the viewer's timezone). */
export function formatLeaveDate(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
