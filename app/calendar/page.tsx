'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Employee, LeaveRequest, LeaveStatus } from '@/types';

export default function CalendarPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date(2026, 0, 1));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [employeesRes, requestsRes] = await Promise.all([
        fetch('/api/employees'),
        fetch('/api/requests'),
      ]);

      const employeesData = await employeesRes.json();
      const requestsData = await requestsRes.json();

      setEmployees(employeesData);
      setRequests(requestsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const monthNames = [
    'Siječanj',
    'Veljača',
    'Ožujak',
    'Travanj',
    'Svibanj',
    'Lipanj',
    'Srpanj',
    'Kolovoz',
    'Rujan',
    'Listopad',
    'Studeni',
    'Prosinac',
  ];

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const prevMonth = () =>
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () =>
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const goToToday = () => {
    const d = new Date();
    setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const days = daysInMonth(currentYear, currentMonth);
  let startDay = firstDayOfMonth(currentYear, currentMonth);
  startDay = startDay === 0 ? 6 : startDay - 1;

  const calendarDays = [];
  for (let i = 0; i < startDay; i++) calendarDays.push(null);
  for (let i = 1; i <= days; i++) calendarDays.push(i);

  const getRequestsForDay = (day: number) => {
    const d = new Date(currentYear, currentMonth, day);
    d.setHours(0, 0, 0, 0);

    return requests.filter((r) => {
      const start = new Date(r.startDate);
      const end = new Date(r.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      return (
        d >= start &&
        d <= end &&
        (r.status === LeaveStatus.APPROVED || r.status === LeaveStatus.REQUESTED)
      );
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-500">Učitavanje...</div>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      <div className="bg-white rounded-[40px] border border-slate-200 shadow-lg shadow-slate-200/50 overflow-hidden">
        {/* Navigation Header */}
        <div className="p-10 md:px-14 md:py-12 flex flex-col sm:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-4">
            <h2 className="text-5xl font-black tracking-tighter flex items-center gap-4">
              <span className="text-[#0041F0]">{monthNames[currentMonth]}</span>
              <span className="text-slate-200 font-light">/</span>
              <span className="text-slate-900">{currentYear}</span>
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex bg-slate-50 p-2 rounded-full border border-slate-100">
              <button
                onClick={prevMonth}
                className="p-3 bg-white border border-slate-100 rounded-full hover:bg-slate-50 transition-all shadow-sm text-slate-400 hover:text-[#0041F0]"
              >
                <ChevronLeft size={20} strokeWidth={3} />
              </button>
              <button
                onClick={goToToday}
                className="mx-2 px-8 py-3 bg-white border border-slate-100 text-xs font-black rounded-full hover:bg-slate-50 transition-all shadow-sm uppercase tracking-[0.2em] text-slate-900"
              >
                Danas
              </button>
              <button
                onClick={nextMonth}
                className="p-3 bg-white border border-slate-100 rounded-full hover:bg-slate-50 transition-all shadow-sm text-slate-400 hover:text-[#0041F0]"
              >
                <ChevronRight size={20} strokeWidth={3} />
              </button>
            </div>
          </div>
        </div>

        {/* Days Header */}
        <div className="grid grid-cols-7 text-center border-y border-slate-200 bg-slate-50/20">
          {['PON', 'UTO', 'SRI', 'ČET', 'PET', 'SUB', 'NED'].map((day, i) => (
            <div
              key={day}
              className={`py-6 text-[10px] font-black uppercase tracking-[0.4em] ${
                i >= 5 ? 'text-[#FF8A80]' : 'text-slate-400'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 auto-rows-[180px]">
          {calendarDays.map((day, idx) => {
            const reqs = day ? getRequestsForDay(day) : [];
            const isWeekend = idx % 7 === 5 || idx % 7 === 6;
            const isToday =
              day &&
              new Date().getDate() === day &&
              new Date().getMonth() === currentMonth &&
              new Date().getFullYear() === currentYear;

            return (
              <div
                key={idx}
                className={`border-r border-b border-slate-200 p-2 flex flex-col relative transition-colors ${
                  !day ? 'bg-slate-50/10' : ''
                } ${isWeekend ? 'bg-slate-50/5' : ''}`}
              >
                {day && (
                  <>
                    <div className="flex justify-between items-start mb-2 px-2">
                      <span
                        className={`text-sm font-black transition-all ${
                          isToday
                            ? 'bg-[#0041F0] text-white w-8 h-8 flex items-center justify-center rounded-full shadow-lg shadow-blue-300/50'
                            : isWeekend
                              ? 'text-[#FF8A80]'
                              : 'text-slate-400'
                        }`}
                      >
                        {day}
                      </span>
                    </div>
                    <div className="flex-1 space-y-1 overflow-y-auto px-1 scrollbar-hide">
                      {reqs.map((r) => {
                        const emp = employees.find((e) => e.id === r.employeeId);
                        const isApproved = r.status === LeaveStatus.APPROVED;
                        return (
                          <div
                            key={r.id}
                            onClick={() => router.push(`/employee/${r.employeeId}`)}
                            className={`text-[11px] font-bold px-3 py-1.5 rounded-full truncate cursor-pointer transition-all hover:translate-y-[-1px] shadow-sm border mx-1 my-0.5 ${
                              isApproved
                                ? 'bg-[#0041F0] text-white border-blue-400'
                                : 'bg-orange-400 text-white border-orange-300'
                            }`}
                            title={`${emp?.name} - ${isApproved ? 'Odobreno' : 'U najavi'}`}
                          >
                            {emp?.name}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend Footer */}
      <div className="flex items-center justify-center gap-12 bg-white px-10 py-6 rounded-full border border-slate-100 shadow-lg shadow-slate-200/50 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full bg-[#0041F0] shadow-sm" />
          <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
            Odobreno
          </span>
        </div>
        <div className="w-px h-6 bg-slate-100" />
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full bg-orange-400 shadow-sm" />
          <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
            U najavi
          </span>
        </div>
      </div>
    </div>
  );
}
