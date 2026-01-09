'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Clock, CalendarDays, AlertCircle, ChevronRight, Check, X } from 'lucide-react';
import { Employee, LeaveRequest, LeaveStatus } from '@/types';

export default function DashboardPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
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

  const handleStatusUpdate = async (requestId: number, status: LeaveStatus) => {
    try {
      const response = await fetch(`/api/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        await fetchData(); // Refresh data
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-500">Učitavanje...</div>
      </div>
    );
  }

  const activeEmployees = employees.filter((e) => e.isActive);
  const pendingRequests = requests.filter((r) => r.status === LeaveStatus.REQUESTED);

  const getInitialsBg = (name: string) => {
    const colors = [
      'bg-blue-100 text-blue-700',
      'bg-indigo-100 text-indigo-700',
      'bg-violet-100 text-violet-700',
      'bg-sky-100 text-sky-700',
    ];
    return colors[name.length % colors.length];
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      <header>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Kontrolna ploča</h1>
        <p className="text-slate-500 mt-2 font-medium">
          Pregled statusa i aktivnih zahtjeva za cijeli tim.
        </p>
      </header>

      {pendingRequests.length > 0 && (
        <section className="bg-white rounded-[24px] border border-slate-200 shadow-lg shadow-slate-200/50 overflow-hidden border-l-8 border-l-orange-400">
          <div className="p-8 border-b border-slate-100 flex items-center gap-3">
            <Clock className="text-orange-500" size={24} strokeWidth={2} />
            <h2 className="text-2xl font-bold text-slate-900">Zahtjevi na čekanju</h2>
            <span className="ml-2 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-black">
              {pendingRequests.length}
            </span>
          </div>
          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
            {pendingRequests.map((req) => {
              const emp = employees.find((e) => e.id === req.employeeId);
              return (
                <div
                  key={req.id}
                  className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-center gap-5">
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl shadow-inner ${
                        emp ? getInitialsBg(emp.name) : 'bg-slate-100'
                      }`}
                    >
                      {emp?.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-xl tracking-tight">{emp?.name}</p>
                      <p className="text-sm font-medium text-slate-500 flex items-center gap-2 mt-1">
                        <CalendarDays size={16} className="text-slate-400" />
                        {new Date(req.startDate).toLocaleDateString('hr-HR')} —{' '}
                        {new Date(req.endDate).toLocaleDateString('hr-HR')}
                        <span className="bg-blue-50 text-[#0041F0] px-2 py-0.5 rounded font-black text-xs">
                          ({req.daysCount} dana)
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleStatusUpdate(req.id, LeaveStatus.APPROVED)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-[#0041F0] text-white rounded-full text-sm font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                    >
                      <Check size={18} strokeWidth={3} /> Odobri
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(req.id, LeaveStatus.DENIED)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-3 border border-slate-200 text-slate-600 rounded-full text-sm font-black hover:bg-slate-50 transition-all"
                    >
                      <X size={18} strokeWidth={3} /> Odbij
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-8">
        <div className="flex items-center gap-3">
          <Users className="text-[#0041F0]" size={28} strokeWidth={2} />
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Zaposlenici</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {activeEmployees.map((emp) => (
            <div
              key={emp.id}
              onClick={() => router.push(`/employee/${emp.id}`)}
              className="bg-white p-8 rounded-[24px] border border-slate-200 shadow-lg shadow-slate-200/50 hover:translate-y-[-4px] transition-all cursor-pointer group relative"
            >
              <div className="absolute top-0 right-0 p-6">
                <ChevronRight
                  className="text-slate-200 group-hover:text-[#0041F0] transform group-hover:translate-x-1 transition-all"
                  size={24}
                  strokeWidth={3}
                />
              </div>

              <div className="flex items-center gap-5 mb-10">
                <div
                  className={`w-16 h-16 rounded-3xl flex items-center justify-center font-bold text-2xl transition-all shadow-inner ${getInitialsBg(
                    emp.name
                  )}`}
                >
                  {emp.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 group-hover:text-[#0041F0] transition-colors tracking-tight">
                    {emp.name}
                  </h3>
                  <p className="text-sm font-medium text-slate-400 truncate max-w-[150px]">
                    {emp.email}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div
                  className={`p-4 rounded-2xl flex flex-col items-center justify-center transition-all ${
                    emp.daysCarryOver > 0 ? 'bg-red-50 border border-red-100' : 'bg-slate-50'
                  }`}
                >
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                    Stari dani
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-xl font-black ${
                        emp.daysCarryOver > 0 ? 'text-red-700' : 'text-slate-400'
                      }`}
                    >
                      {emp.daysCarryOver}
                    </span>
                    {emp.daysCarryOver > 0 && (
                      <AlertCircle className="text-red-500" size={16} strokeWidth={2} />
                    )}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 flex flex-col items-center justify-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#0041F0]/50 mb-1">
                    Novi dani
                  </span>
                  <span className="text-xl font-black text-[#0041F0]">{emp.daysCurrentYear}</span>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-50 flex justify-between items-center">
                <span className="text-sm font-bold text-slate-400">Dostupno ukupno</span>
                <span className="text-xl font-black text-slate-900">
                  {emp.daysCarryOver + emp.daysCurrentYear}{' '}
                  <span className="text-sm font-medium text-slate-400">dana</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
