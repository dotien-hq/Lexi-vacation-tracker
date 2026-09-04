'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  CheckCircle,
  Ban,
  CalendarClock,
  Trash2,
  Mail,
  Calendar,
  Clock,
  AlertTriangle,
  Info,
} from 'lucide-react';
import type { LeaveRequestWithProfile } from '@/types';
import { calculateBusinessDays, parseLocalDate } from '@/lib/holidayCalculator';
import { canPerform } from '@/lib/requestTransitions';
import { formatLeaveDate } from '@/lib/requestStatus';
import RequestStatusBadge from '@/components/RequestStatusBadge';

type Mode = 'view' | 'reschedule' | 'cancel' | 'delete';

interface EventDetailModalProps {
  request: LeaveRequestWithProfile;
  onClose: () => void;
  /** Called after every successful mutation (and after a 409/404). Parent should refetch requests. */
  onChanged: () => Promise<void>;
  onNotify: (type: 'success' | 'error', text: string) => void;
}

/** Prisma stores dates as UTC midnight; the ISO string's first 10 chars are the calendar date. */
const toInputDate = (iso: string) => iso.slice(0, 10);

// Mirrors the server-side range in lib/validations.ts
const DATE_MIN = '2020-01-01';
const DATE_MAX = '2100-12-31';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled])';

const inputClass =
  'w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0041F0] focus:border-transparent';
const btnBase =
  'flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed';
const btnSecondary = `${btnBase} border border-slate-200 text-slate-600 hover:bg-slate-50`;

export default function EventDetailModal({
  request,
  onClose,
  onChanged,
  onNotify,
}: EventDetailModalProps) {
  const [mode, setMode] = useState<Mode>('view');
  const [startDate, setStartDate] = useState(toInputDate(request.startDate));
  const [endDate, setEndDate] = useState(toInputDate(request.endDate));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const mouseDownOnBackdrop = useRef(false);

  // Fresh data from the parent (after a 409/404 refetch) resets the form.
  useEffect(() => {
    setStartDate(toInputDate(request.startDate));
    setEndDate(toInputDate(request.endDate));
  }, [request.id, request.startDate, request.endDate]);

  // Focus the dialog on open; return focus to whatever opened it on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => opener?.focus();
  }, []);

  // Escape closes (unless busy). Tab / Shift+Tab cycle within the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!busy) onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusables = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === dialogRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const name = request.profile.fullName || request.profile.email;
  const dayWord = request.daysCount === 1 ? 'day' : 'days';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const alreadyTaken = request.status === 'APPROVED' && parseLocalDate(request.endDate) < today;

  const previewDays = useMemo(() => {
    if (!startDate || !endDate || endDate < startDate) return null;
    return calculateBusinessDays(startDate, endDate);
  }, [startDate, endDate]);

  const datesChanged =
    startDate !== toInputDate(request.startDate) || endDate !== toInputDate(request.endDate);

  async function mutate(init: RequestInit, successText: string) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/requests/${request.id}`, init);
      if (!res.ok) {
        const data: unknown = await res.json().catch(() => null);
        const serverMessage =
          data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
            ? data.error
            : null;
        setError(serverMessage || 'Something went wrong. Please try again.');
        // Stale data: someone else changed or deleted this request. Refresh so the
        // buttons reflect reality (a 404 unmounts us via the parent's derived selection).
        if (res.status === 409 || res.status === 404) {
          await onChanged();
          setMode('view');
        }
        return;
      }
      onNotify('success', successText);
      await onChanged();
      onClose();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const patch = (body: Record<string, unknown>, successText: string) =>
    mutate(
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      successText
    );

  const backButton = (
    <button
      type="button"
      onClick={() => {
        setMode('view');
        setError('');
      }}
      disabled={busy}
      className={`${btnSecondary} flex-1`}
    >
      Back
    </button>
  );

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => {
        mouseDownOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (mouseDownOnBackdrop.current && e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-modal-title"
        className="bg-white rounded-[24px] shadow-2xl max-w-lg w-full p-8 outline-none max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 id="event-modal-title" className="text-2xl font-bold text-slate-900">
              {name}
            </h2>
            <RequestStatusBadge status={request.status} className="mt-2" />
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
          >
            <X size={24} />
          </button>
        </div>

        {/* Details (icons live inside <dd> to keep the <dl> content model valid) */}
        <dl className="mb-6 p-4 bg-slate-50 rounded-lg space-y-2 text-sm text-slate-600">
          <div>
            <dt className="sr-only">Email</dt>
            <dd className="flex items-center gap-2">
              <Mail size={14} className="text-slate-500" aria-hidden="true" />
              {request.profile.email}
            </dd>
          </div>
          <div>
            <dt className="sr-only">Dates</dt>
            <dd className="flex items-center gap-2">
              <Calendar size={14} className="text-slate-500" aria-hidden="true" />
              {formatLeaveDate(request.startDate)} – {formatLeaveDate(request.endDate)}
            </dd>
          </div>
          <div>
            <dt className="sr-only">Duration</dt>
            <dd className="flex items-center gap-2 font-bold text-[#0041F0]">
              <Clock size={14} aria-hidden="true" />
              {request.daysCount} business {dayWord}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="text-slate-500">Requested on</dt>
            <dd>
              {new Date(request.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </dd>
          </div>
          {request.rejectionReason && (
            <div className="flex items-start gap-2">
              <dt className="text-slate-500">Reason</dt>
              <dd className={request.status === 'DENIED' ? 'text-red-700' : 'text-slate-700'}>
                {request.rejectionReason}
              </dd>
            </div>
          )}
        </dl>

        {alreadyTaken && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900 flex gap-2">
            <Info size={16} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              This leave has already been taken. Cancelling, rescheduling or deleting it will still
              refund {request.daysCount} {dayWord}.
            </span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800"
          >
            {error}
          </div>
        )}

        {/* View: actions */}
        {mode === 'view' && (
          <div className="grid grid-cols-2 gap-3">
            {canPerform('APPROVE', request.status) && (
              <button
                type="button"
                onClick={() => patch({ status: 'APPROVED' }, 'Request approved')}
                disabled={busy}
                className={`${btnBase} bg-green-600 text-white hover:bg-green-700`}
              >
                <CheckCircle size={18} strokeWidth={2.5} aria-hidden="true" />
                Approve
              </button>
            )}
            {canPerform('CANCEL', request.status) && (
              <button
                type="button"
                onClick={() => {
                  setReason('');
                  setError('');
                  setMode('cancel');
                }}
                disabled={busy}
                className={`${btnBase} bg-amber-700 text-white hover:bg-amber-600`}
              >
                <Ban size={18} strokeWidth={2.5} aria-hidden="true" />
                Cancel leave
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setError('');
                setMode('reschedule');
              }}
              disabled={busy}
              className={`${btnBase} border border-[#0041F0] text-[#0041F0] hover:bg-blue-50`}
            >
              <CalendarClock size={18} strokeWidth={2.5} aria-hidden="true" />
              Reschedule
            </button>
            <button
              type="button"
              onClick={() => {
                setError('');
                setMode('delete');
              }}
              disabled={busy}
              className={`${btnBase} border border-red-300 text-red-600 hover:bg-red-50`}
            >
              <Trash2 size={18} strokeWidth={2.5} aria-hidden="true" />
              Delete
            </button>
          </div>
        )}

        {/* Reschedule */}
        {mode === 'reschedule' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              patch({ startDate, endDate }, 'Dates updated. Request is pending re-approval.');
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="reschedule-start"
                  className="block text-sm font-bold text-slate-700 mb-2"
                >
                  Start Date
                </label>
                <input
                  id="reschedule-start"
                  type="date"
                  value={startDate}
                  min={DATE_MIN}
                  max={DATE_MAX}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label
                  htmlFor="reschedule-end"
                  className="block text-sm font-bold text-slate-700 mb-2"
                >
                  End Date
                </label>
                <input
                  id="reschedule-end"
                  type="date"
                  value={endDate}
                  min={startDate || DATE_MIN}
                  max={DATE_MAX}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
            </div>

            {previewDays !== null && (
              <p className="text-sm font-bold text-blue-900">Business days: {previewDays}</p>
            )}

            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800 flex gap-2">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                Saving sets the status to Pending and requires approval again.
                {request.status === 'APPROVED' &&
                  ` The current ${request.daysCount} ${dayWord} will be refunded.`}
              </span>
            </div>

            <div className="flex gap-3">
              {backButton}
              <button
                type="submit"
                disabled={busy || !datesChanged || !previewDays}
                className={`${btnBase} flex-1 bg-[#0041F0] text-white hover:bg-blue-700`}
              >
                {busy ? 'Saving...' : 'Save new dates'}
              </button>
            </div>
          </form>
        )}

        {/* Cancel */}
        {mode === 'cancel' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              patch(
                { status: 'CANCELLED', rejectionReason: reason.trim() || undefined },
                'Leave cancelled'
              );
            }}
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="cancel-reason"
                className="block text-sm font-bold text-slate-700 mb-2"
              >
                Reason (optional)
              </label>
              <textarea
                id="cancel-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                rows={3}
                className={`${inputClass} resize-none`}
              />
            </div>
            {request.status === 'APPROVED' && (
              <p className="text-sm text-slate-600">
                {request.daysCount} {dayWord} will be refunded to {name}.
              </p>
            )}
            <div className="flex gap-3">
              {backButton}
              <button
                type="submit"
                disabled={busy}
                className={`${btnBase} flex-1 bg-amber-700 text-white hover:bg-amber-600`}
              >
                {busy ? 'Cancelling...' : 'Confirm cancellation'}
              </button>
            </div>
          </form>
        )}

        {/* Delete */}
        {mode === 'delete' && (
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              This permanently deletes the request
              {request.status === 'APPROVED' && ` and refunds ${request.daysCount} ${dayWord}`}.
              This cannot be undone.
            </div>
            <div className="flex gap-3">
              {backButton}
              <button
                type="button"
                onClick={() => mutate({ method: 'DELETE' }, 'Request deleted')}
                disabled={busy}
                className={`${btnBase} flex-1 bg-red-600 text-white hover:bg-red-700`}
              >
                {busy ? 'Deleting...' : 'Delete permanently'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
