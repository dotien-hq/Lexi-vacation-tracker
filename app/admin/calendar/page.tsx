'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertTriangle } from 'lucide-react';
import { getHolidaysForMonth, Holiday } from '@/lib/holidayCalculator';

interface Profile {
  id: string;
  email: string;
  fullName: string | null;
}

interface LeaveRequest {
  id: string;
  profileId: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  status: 'REQUESTED' | 'APPROVED' | 'DENIED';
  profile: Profile;
}

export default function AdminCalendarPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

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

  const fetchRequests = useCallback(async () => {
    try {
      const response = await fetch('/api/requests?status=APPROVED');
      if (response.ok) {
        const data = await response.json();
        setRequests(data);
      } else {
        console.error('Failed to fetch requests');
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthorized) {
      fetchRequests();
    }
  }, [fetchRequests, isAuthorized]);

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

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Get holidays for current month
  const monthHolidays = useMemo(() => {
    const holidays = getHolidaysForMonth(currentYear, currentMonth);
    // Create a map for O(1) lookup by day number
    const holidayMap = new Map<number, Holiday>();
    holidays.forEach((h) => {
      const day = parseInt(h.date.split('-')[2], 10);
      holidayMap.set(day, h);
    });
    return holidayMap;
  }, [currentYear, currentMonth]);

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  // Convert Sunday (0) to 6, and shift Monday to 0
  const startDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const prevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Build calendar grid
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  // Get requests for a specific day
  const getRequestsForDay = (day: number): LeaveRequest[] => {
    const date = new Date(currentYear, currentMonth, day);
    date.setHours(0, 0, 0, 0);

    return requests.filter((request) => {
      const start = new Date(request.startDate);
      const end = new Date(request.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);

      return date >= start && date <= end;
    });
  };

  // Detect overlaps for a specific day
  const hasOverlap = (day: number): boolean => {
    const dayRequests = getRequestsForDay(day);
    return dayRequests.length > 1;
  };

  const isToday = (day: number): boolean => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentMonth === today.getMonth() &&
      currentYear === today.getFullYear()
    );
  };

  const isWeekend = (dayIndex: number): boolean => {
    return dayIndex % 7 === 5 || dayIndex % 7 === 6;
  };

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
          View approved leave requests and identify scheduling conflicts.
        </p>
      </header>

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
              onClick={prevMonth}
              className="p-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-all"
              title="Previous month"
            >
              <ChevronLeft size={20} strokeWidth={2.5} />
            </button>
            <button
              onClick={goToToday}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition-all"
            >
              Today
            </button>
            <button
              onClick={nextMonth}
              className="p-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-all"
              title="Next month"
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
            const dayRequests = day ? getRequestsForDay(day) : [];
            const overlap = day ? hasOverlap(day) : false;
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
                    {/* Day Number and Holiday Name */}
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
                        <div title="Multiple people away">
                          <AlertTriangle size={16} className="text-orange-500" />
                        </div>
                      )}
                    </div>

                    {/* Holiday Label */}
                    {holiday && (
                      <div
                        className="text-[10px] font-semibold text-purple-700 mb-1 truncate"
                        title={`${holiday.name} (${holiday.nameHr})`}
                      >
                        {holiday.name}
                      </div>
                    )}

                    {/* Leave Requests */}
                    <div className="flex-1 space-y-1 overflow-y-auto">
                      {dayRequests.map((request) => (
                        <div
                          key={request.id}
                          className="text-xs font-bold px-2 py-1 rounded bg-[#0041F0] text-white truncate cursor-default hover:bg-blue-700 transition-colors"
                          title={`${request.profile.fullName || request.profile.email} - ${new Date(request.startDate).toLocaleDateString()} to ${new Date(request.endDate).toLocaleDateString()}`}
                        >
                          {request.profile.fullName || request.profile.email.split('@')[0]}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-6 bg-white px-8 py-4 rounded-[24px] border border-slate-200 shadow-lg shadow-slate-200/50">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-[#0041F0]" />
          <span className="text-sm font-medium text-slate-600">Approved Leave</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-purple-100 border border-purple-300" />
          <span className="text-sm font-medium text-slate-600">Public Holiday</span>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-orange-500" />
          <span className="text-sm font-medium text-slate-600">Overlap Detected</span>
        </div>
      </div>
    </div>
  );
}
