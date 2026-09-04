'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertTriangle } from 'lucide-react';
import { getHolidaysForMonth, Holiday, parseLocalDate } from '@/lib/holidayCalculator';
import {
  ALL_REQUEST_STATUSES,
  OVERLAP_STATUSES,
  REQUEST_STATUS_META,
  REQUEST_STATUS_PRIORITY,
  formatLeaveDate,
} from '@/lib/requestStatus';
import type { LeaveRequestWithProfile, RequestStatusValue } from '@/types';
import EventDetailModal from '@/components/calendar/EventDetailModal';

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function AdminCalendarPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [requests, setRequests] = useState<LeaveRequestWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [visibleStatuses, setVisibleStatuses] = useState<Set<RequestStatusValue>>(
    () => new Set(ALL_REQUEST_STATUSES)
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showMessage = useCallback((type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  }, []);

  // Check user role before rendering admin content
  useEffect(() => {
    async function checkRole() {
      try {
        const res = await fetch('/api/profile/me');
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const profile = await res.json();
        if (profile?.role !== 'ADMIN') {
          router.push('/access-denied');
          return;
        }
        setIsAuthorized(true);
      } catch (error) {
        console.error('Failed to verify role:', error);
        router.push('/login');
      } finally {
        setIsChecking(false);
      }
    }
    checkRole();
  }, [router]);

  // NOTE: never sets loading=true — refetches after modal actions must not unmount the modal.
  const fetchRequests = useCallback(async () => {
    try {
      const response = await fetch('/api/requests');
      if (response.ok) {
        setRequests(await response.json());
      } else {
        showMessage('error', 'Failed to load requests');
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error);
      showMessage('error', 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [showMessage]);

  useEffect(() => {
    if (isAuthorized) {
      fetchRequests();
    }
  }, [fetchRequests, isAuthorized]);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const startDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; // Monday-first grid

  const monthHolidays = useMemo(() => {
    const holidayMap = new Map<number, Holiday>();
    getHolidaysForMonth(currentYear, currentMonth).forEach((h) => {
      holidayMap.set(parseInt(h.date.split('-')[2], 10), h);
    });
    return holidayMap;
  }, [currentYear, currentMonth]);

  // day-of-month → every request (any status) covering that day
  const requestsByDay = useMemo(() => {
    const map = new Map<number, LeaveRequestWithProfile[]>();
    for (let day = 1; day <= daysInMonth; day++) map.set(day, []);

    const monthStart = new Date(currentYear, currentMonth, 1);
    const monthEnd = new Date(currentYear, currentMonth, daysInMonth);

    for (const request of requests) {
      const start = parseLocalDate(request.startDate);
      const end = parseLocalDate(request.endDate);
      if (end < monthStart || start > monthEnd) continue;

      const from = start < monthStart ? 1 : start.getDate();
      const to = end > monthEnd ? daysInMonth : end.getDate();
      for (let day = from; day <= to; day++) {
        map.get(day)!.push(request);
      }
    }
    for (const list of map.values()) {
      list.sort((a, b) => REQUEST_STATUS_PRIORITY[a.status] - REQUEST_STATUS_PRIORITY[b.status]);
    }
    return map;
  }, [requests, currentYear, currentMonth, daysInMonth]);

  const selectedRequest = selectedId ? (requests.find((r) => r.id === selectedId) ?? null) : null;
  const closeModal = useCallback(() => setSelectedId(null), []);

  const toggleStatus = (status: RequestStatusValue) => {
    setVisibleStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const prevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const calendarDays: (number | null)[] = [
    ...Array<null>(startDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentMonth === today.getMonth() &&
      currentYear === today.getFullYear()
    );
  };
  const isWeekend = (dayIndex: number) => dayIndex % 7 === 5 || dayIndex % 7 === 6;

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-500">Verifying permissions...</div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null; // Redirecting
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Team Calendar</h1>
        <p className="text-slate-500 mt-2 font-medium">
          View and manage all leave requests, and spot scheduling conflicts. Click an entry for
          details.
        </p>
      </header>

      {message && (
        <div
          role="status"
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Calendar Container */}
      <section className="bg-white rounded-[24px] border border-slate-200 shadow-lg shadow-slate-200/50 overflow-hidden">
        {/* Calendar Header */}
        <div className="p-8 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <CalendarIcon className="text-[#0041F0]" size={24} strokeWidth={2} />
            <h2 className="text-2xl font-bold text-slate-900">
              {monthNames[currentMonth]} {currentYear}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={prevMonth}
              className="p-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-all"
              title="Previous month"
              aria-label="Previous month"
            >
              <ChevronLeft size={20} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition-all"
            >
              Today
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="p-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-all"
              title="Next month"
              aria-label="Next month"
            >
              <ChevronRight size={20} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Day Names Header */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {dayNames.map((day, index) => (
            <div
              key={day}
              className={`py-3 text-center text-xs font-black uppercase tracking-wider ${
                index >= 5 ? 'text-red-400' : 'text-slate-400'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 auto-rows-[140px]">
          {calendarDays.map((day, index) => {
            const allForDay = day ? (requestsByDay.get(day) ?? []) : [];
            const dayRequests = allForDay.filter((r) => visibleStatuses.has(r.status));
            const peopleAway = new Set(
              allForDay.filter((r) => OVERLAP_STATUSES.includes(r.status)).map((r) => r.profileId)
            );
            const overlap = peopleAway.size > 1;
            const weekend = isWeekend(index);
            const today = day ? isToday(day) : false;
            const holiday = day ? monthHolidays.get(day) : undefined;

            return (
              <div
                key={index}
                className={`border-r border-b border-slate-200 p-2 flex flex-col relative ${
                  !day ? 'bg-slate-50/30' : ''
                } ${holiday ? 'bg-purple-50' : weekend ? 'bg-slate-50/50' : ''} ${today ? 'bg-blue-50/30' : ''}`}
              >
                {day && (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-sm font-bold ${
                          today
                            ? 'bg-[#0041F0] text-white w-7 h-7 flex items-center justify-center rounded-full'
                            : holiday
                              ? 'text-purple-600'
                              : weekend
                                ? 'text-red-400'
                                : 'text-slate-600'
                        }`}
                      >
                        {day}
                      </span>
                      {overlap && (
                        <span
                          role="img"
                          aria-label="Multiple people away"
                          title="Multiple people away"
                        >
                          <AlertTriangle size={16} className="text-orange-500" aria-hidden="true" />
                        </span>
                      )}
                    </div>

                    {holiday && (
                      <div
                        className="text-[10px] font-semibold text-purple-700 mb-1 truncate"
                        title={`${holiday.name} (${holiday.nameHr})`}
                      >
                        {holiday.name}
                      </div>
                    )}

                    <div className="flex-1 space-y-1 overflow-y-auto">
                      {dayRequests.map((request) => {
                        const meta = REQUEST_STATUS_META[request.status];
                        const name = request.profile.fullName || request.profile.email;
                        const range = `${formatLeaveDate(request.startDate)} – ${formatLeaveDate(request.endDate)}`;
                        return (
                          <button
                            type="button"
                            key={request.id}
                            onClick={() => setSelectedId(request.id)}
                            title={`${name} · ${meta.label} · ${range}`}
                            aria-label={`${name}, ${meta.label}, ${range}`}
                            className={`w-full text-left text-xs font-bold px-2 py-1 rounded truncate transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0041F0] ${meta.chip}`}
                          >
                            {request.profile.fullName || request.profile.email.split('@')[0]}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Legend + status filters */}
      <div className="flex flex-wrap items-center justify-center gap-3 bg-white px-8 py-4 rounded-[24px] border border-slate-200 shadow-lg shadow-slate-200/50">
        {ALL_REQUEST_STATUSES.map((status) => {
          const meta = REQUEST_STATUS_META[status];
          const on = visibleStatuses.has(status);
          return (
            <button
              type="button"
              key={status}
              onClick={() => toggleStatus(status)}
              aria-pressed={on}
              title={
                on
                  ? `Hide ${meta.label.toLowerCase()} requests`
                  : `Show ${meta.label.toLowerCase()} requests`
              }
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
                on
                  ? 'border-slate-300 bg-slate-50 text-slate-700'
                  : 'border-dashed border-slate-300 bg-white text-slate-500'
              }`}
            >
              <span
                className={`w-4 h-4 rounded ${meta.swatch} ${on ? '' : 'opacity-30'}`}
                aria-hidden="true"
              />
              <span className="text-sm font-medium">{meta.label}</span>
            </button>
          );
        })}
        <div className="flex items-center gap-2 px-3 py-1.5">
          <div className="w-4 h-4 rounded bg-purple-100 border border-purple-300" />
          <span className="text-sm font-medium text-slate-600">Public Holiday</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5">
          <AlertTriangle size={16} className="text-orange-500" />
          <span className="text-sm font-medium text-slate-600">Overlap Detected</span>
        </div>
      </div>

      {selectedRequest && (
        <EventDetailModal
          request={selectedRequest}
          onClose={closeModal}
          onChanged={fetchRequests}
          onNotify={showMessage}
        />
      )}
    </div>
  );
}
