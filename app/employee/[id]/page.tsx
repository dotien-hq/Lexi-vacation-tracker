'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  AlertTriangle,
  Send,
  Trash2,
  Edit3,
  X,
  Check,
  History,
  FileText,
} from 'lucide-react';
import { Employee, LeaveRequest, LeaveStatus } from '@/types';
import { calculateBusinessDays } from '@/lib/holidayCalculator';

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [daysPreview, setDaysPreview] = useState(0);
  const [error, setError] = useState('');
  const [editingReqId, setEditingReqId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchEmployee();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const count = calculateBusinessDays(start, end);
      setDaysPreview(count);

      const totalAvailableDays = (employee?.daysCarryOver || 0) + (employee?.daysCurrentYear || 0);
      if (count > totalAvailableDays) {
        setError('Nema dovoljno dostupnih dana.');
      } else {
        setError('');
      }
    } else {
      setDaysPreview(0);
      setError('');
    }
  }, [startDate, endDate, employee?.daysCarryOver, employee?.daysCurrentYear]);

  const fetchEmployee = async () => {
    try {
      const response = await fetch(`/api/employees/${id}`);
      if (response.ok) {
        const data = await response.json();
        setEmployee(data);
        setRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Failed to fetch employee:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (error || daysPreview === 0 || !employee || isSubmitting) return;

    setIsSubmitting(true);
    try {
      let response;
      if (editingReqId) {
        response = await fetch(`/api/requests/${editingReqId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ startDate, endDate }),
        });
      } else {
        response = await fetch('/api/requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeeId: employee.id,
            startDate,
            endDate,
          }),
        });
      }

      if (!response.ok) {
        throw new Error('Failed to submit request');
      }

      setStartDate('');
      setEndDate('');
      setEditingReqId(null);
      await fetchEmployee();
    } catch (error) {
      console.error('Failed to submit request:', error);
      alert('Greška pri spremanju zahtjeva. Pokušajte ponovno.');
    } finally {
      setIsSubmitting(false);
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
        await fetchEmployee(); // Refresh data
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const deleteRequest = async (requestId: number) => {
    try {
      const response = await fetch(`/api/requests/${requestId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchEmployee(); // Refresh data
      }
    } catch (error) {
      console.error('Failed to delete request:', error);
    }
  };

  const startEditing = (req: LeaveRequest) => {
    if (req.status === LeaveStatus.APPROVED) {
      if (
        !confirm(
          'Ovaj zahtjev je već odobren. Uređivanje će vratiti dane zaposleniku. Želite li nastaviti?'
        )
      ) {
        return;
      }
    }
    setEditingReqId(req.id);
    setStartDate(req.startDate);
    setEndDate(req.endDate);
    // Scroll to form smoothly only if it's not visible
    const formElement = document.querySelector('form');
    if (formElement) {
      const rect = formElement.getBoundingClientRect();
      const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
      if (!isVisible) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const getInitialsBg = (name: string) => {
    const colors = [
      'bg-blue-100 text-blue-700',
      'bg-indigo-100 text-indigo-700',
      'bg-violet-100 text-violet-700',
      'bg-sky-100 text-sky-700',
    ];
    return colors[name.length % colors.length];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-500">Učitavanje...</div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-black text-slate-900">Zaposlenik nije pronađen</h2>
        <button
          onClick={() => router.push('/dashboard')}
          className="mt-4 text-[#0041F0] font-bold hover:underline"
        >
          Natrag na dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <button
        onClick={() => router.push('/dashboard')}
        className="group flex items-center gap-3 text-slate-500 hover:text-[#0041F0] transition-all"
      >
        <div className="p-2 rounded-full bg-white border border-slate-200 group-hover:border-[#0041F0] transition-all shadow-sm">
          <ArrowLeft size={16} strokeWidth={3} />
        </div>
        <span className="font-bold text-sm">Povratak</span>
      </button>

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <div className="flex items-center gap-5 mb-4">
            <div
              className={`w-20 h-20 rounded-[28px] flex items-center justify-center text-4xl font-black shadow-xl shadow-blue-200/20 ${getInitialsBg(
                employee.name
              )}`}
            >
              {employee.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-5xl font-black text-slate-900 tracking-tighter leading-none">
                {employee.name}
              </h1>
              <p className="text-xl text-slate-400 font-semibold mt-2">{employee.email}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-6">
          <div className="bg-white px-10 py-6 rounded-[24px] border border-slate-200 shadow-lg shadow-slate-200/50 text-center min-w-[160px]">
            <span className="block text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-2">
              STARI DANI
            </span>
            <span
              className={`text-2xl font-black ${
                employee.daysCarryOver > 0 ? 'text-red-600' : 'text-slate-200'
              }`}
            >
              {employee.daysCarryOver}
            </span>
          </div>
          <div className="bg-blue-50 px-10 py-6 rounded-[24px] border border-blue-100 shadow-lg shadow-blue-200/50 text-center min-w-[160px]">
            <span className="block text-[10px] text-[#0041F0]/60 font-black uppercase tracking-[0.2em] mb-2">
              NOVI DANI
            </span>
            <span className="text-2xl font-black text-[#0041F0]">{employee.daysCurrentYear}</span>
          </div>
        </div>
      </header>

      {employee.daysCarryOver > 0 && (
        <div className="bg-red-50 border border-red-100 p-6 rounded-[24px] flex items-center gap-5 text-red-900 shadow-sm shadow-red-50">
          <div className="p-3 bg-white rounded-2xl shadow-sm text-red-500">
            <AlertTriangle size={28} strokeWidth={2.5} />
          </div>
          <p className="font-bold text-lg">
            Važno: Imate još{' '}
            <span className="bg-white px-2 py-0.5 rounded shadow-sm font-black text-red-600 mx-1">
              {employee.daysCarryOver} stara dana
            </span>{' '}
            koje morate iskoristiti do 30. lipnja!
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Form Section */}
        <section className="lg:col-span-5">
          <div className="bg-white p-10 md:p-12 rounded-[40px] border border-slate-100 shadow-lg shadow-slate-200/50 sticky top-28">
            <h2 className="text-3xl font-black text-slate-900 mb-12 flex items-center gap-4 tracking-tight">
              <CalendarIcon size={32} className="text-[#0041F0]" strokeWidth={2.5} />
              {editingReqId ? 'Uredi zahtjev' : 'Novi zahtjev'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-10">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-4">
                  Početni datum
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  onClick={(e) => e.currentTarget.showPicker?.()}
                  className="w-full px-8 py-6 rounded-2xl border border-slate-200 bg-[#F9FAFB] hover:border-slate-300 focus:outline-none focus:ring-4 focus:ring-blue-600/20 focus:border-[#0041F0] transition-all font-medium text-lg text-slate-900 shadow-sm cursor-pointer"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-4">
                  Završni datum
                </label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                  onClick={(e) => e.currentTarget.showPicker?.()}
                  className="w-full px-8 py-6 rounded-2xl border border-slate-200 bg-[#F9FAFB] hover:border-slate-300 focus:outline-none focus:ring-4 focus:ring-blue-600/20 focus:border-[#0041F0] transition-all font-medium text-lg text-slate-900 shadow-sm cursor-pointer"
                  required
                />
              </div>

              {daysPreview > 0 && (
                <div
                  className={`p-8 rounded-3xl border transition-all ${
                    error
                      ? 'bg-red-50 border-red-100 shadow-red-50'
                      : 'bg-blue-50 border-blue-100 shadow-blue-50'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest text-[10px]">
                      Trajanje:
                    </span>
                    <span
                      className={`text-xl font-black ${error ? 'text-red-600' : 'text-[#0041F0]'}`}
                    >
                      {daysPreview} radna dana
                    </span>
                  </div>
                  {error && (
                    <div className="flex items-center gap-2 mt-4 text-red-600">
                      <AlertTriangle size={16} strokeWidth={3} />
                      <p className="text-xs font-black tracking-tight">{error}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-4">
                <button
                  type="submit"
                  disabled={!!error || !startDate || !endDate || isSubmitting}
                  className="w-full bg-[#94AEFF] hover:bg-[#839EF0] text-white font-black py-6 rounded-full shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-4 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                      <span className="text-lg">Spremanje...</span>
                    </>
                  ) : (
                    <>
                      <Send size={24} strokeWidth={2} className="rotate-[-10deg]" />
                      <span className="text-lg">
                        {editingReqId ? 'Spremi promjene' : 'Pošalji zahtjev'}
                      </span>
                    </>
                  )}
                </button>
                {editingReqId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingReqId(null);
                      setStartDate('');
                      setEndDate('');
                    }}
                    disabled={isSubmitting}
                    className="w-full py-4 text-slate-400 font-bold hover:text-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Odustani
                  </button>
                )}
              </div>
            </form>
          </div>
        </section>

        {/* History Section */}
        <section className="lg:col-span-7 space-y-6">
          <div className="flex items-center gap-3">
            <History className="text-slate-300" size={28} strokeWidth={2} />
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Povijest odmora</h2>
          </div>

          <div className="bg-white rounded-[32px] border border-slate-100 shadow-lg shadow-slate-200/50 overflow-hidden">
            <div className="w-full divide-y divide-slate-100">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="group px-8 py-5 flex items-center gap-6 hover:bg-slate-50 transition-colors"
                >
                  {/* Column 1: Icon */}
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 transition-colors group-hover:bg-blue-100">
                    <CalendarIcon className="text-blue-600" size={18} strokeWidth={2.5} />
                  </div>

                  {/* Column 2: Information Stack */}
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-900 font-semibold text-base whitespace-nowrap overflow-hidden text-ellipsis">
                      {new Date(req.startDate).toLocaleDateString('hr-HR')} —{' '}
                      {new Date(req.endDate).toLocaleDateString('hr-HR')}
                    </div>
                    <div className="text-sm text-slate-500 mt-0.5 font-medium">
                      {req.daysCount} dana • Kreirano{' '}
                      {new Date(req.createdAt).toLocaleDateString('hr-HR')}
                    </div>
                  </div>

                  {/* Column 3: Status Pill */}
                  <div className="hidden sm:block">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full border tracking-wider uppercase whitespace-nowrap ${
                        req.status === LeaveStatus.APPROVED
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : req.status === LeaveStatus.DENIED
                            ? 'bg-red-50 text-red-700 border-red-100'
                            : 'bg-amber-50 text-amber-700 border-amber-100'
                      }`}
                    >
                      {req.status === LeaveStatus.APPROVED
                        ? 'Odobreno'
                        : req.status === LeaveStatus.DENIED
                          ? 'Odbijeno'
                          : 'Na čekanju'}
                    </span>
                  </div>

                  {/* Column 4: Actions (Far Right) */}
                  <div className="flex items-center gap-1 ml-auto">
                    {req.status === LeaveStatus.REQUESTED && (
                      <>
                        <button
                          onClick={() => handleStatusUpdate(req.id, LeaveStatus.APPROVED)}
                          className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-100 rounded-full transition-all"
                          title="Odobri"
                        >
                          <Check size={18} strokeWidth={3} />
                        </button>
                        <button
                          onClick={() => handleStatusUpdate(req.id, LeaveStatus.DENIED)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded-full transition-all"
                          title="Odbij"
                        >
                          <X size={18} strokeWidth={3} />
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => startEditing(req)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-full transition-all"
                      title="Uredi"
                    >
                      <Edit3 size={18} strokeWidth={2} />
                    </button>

                    <button
                      onClick={() => {
                        if (confirm('Jeste li sigurni da želite obrisati ovaj zahtjev?'))
                          deleteRequest(req.id);
                      }}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded-full transition-all"
                      title="Obriši"
                    >
                      <Trash2 size={18} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              ))}

              {requests.length === 0 && (
                <div className="p-24 text-center">
                  <div className="flex flex-col items-center gap-5">
                    <div className="w-20 h-20 rounded-[30px] bg-slate-50 flex items-center justify-center text-slate-200">
                      <FileText size={40} />
                    </div>
                    <p className="text-slate-400 font-semibold italic text-lg">
                      Nema povijesti zahtjeva za ovog zaposlenika.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
