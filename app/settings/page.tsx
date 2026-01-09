'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Download,
  Edit2,
  Archive,
  Users,
  UserPlus,
  X,
  CheckCircle2,
} from 'lucide-react';
import { Employee } from '@/types';

export default function SettingsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>(
    'active'
  );

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    carryOver: 0,
    currentYear: 20,
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/employees');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      }
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingEmp) {
        const response = await fetch(
          `/api/employees/${editingEmp.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: formData.name,
              email: formData.email,
              daysCarryOver: formData.carryOver,
              daysCurrentYear: formData.currentYear,
            }),
          }
        );
        if (response.ok) {
          setEditingEmp(null);
        }
      } else {
        const response = await fetch('/api/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            daysCarryOver: formData.carryOver,
            daysCurrentYear: formData.currentYear,
          }),
        });
      }

      setFormData({
        name: '',
        email: '',
        carryOver: 0,
        currentYear: 20,
      });
      setShowAddForm(false);
      await fetchEmployees(); // Refresh data
    } catch (error) {
      console.error('Failed to save employee:', error);
    }
  };

  const updateEmployee = async (
    id: number,
    updates: Partial<Employee>
  ) => {
    try {
      const response = await fetch(`/api/employees/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        await fetchEmployees(); // Refresh data
      }
    } catch (error) {
      console.error('Failed to update employee:', error);
    }
  };

  const exportData = async () => {
    try {
      const response = await fetch('/api/backup');
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vacation-backup-${
          new Date().toISOString().split('T')[0]
        }.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to export data:', error);
    }
  };

  const startEdit = (emp: Employee) => {
    setEditingEmp(emp);
    setFormData({
      name: emp.name,
      email: emp.email,
      carryOver: emp.daysCarryOver,
      currentYear: emp.daysCurrentYear,
    });
    setShowAddForm(true);
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

  const filteredEmployees = employees.filter((e) =>
    activeTab === 'active' ? e.isActive : !e.isActive
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-500">Učitavanje...</div>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div className="flex items-center gap-5">
          <div className="bg-slate-900 p-5 rounded-[28px] text-white shadow-xl shadow-slate-200">
            <SettingsIcon size={32} strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tighter">
              Administracija
            </h1>
            <p className="text-slate-500 font-semibold mt-1">
              Upravljanje zaposlenicima i postavkama sustava.
            </p>
          </div>
        </div>
        <button
          onClick={exportData}
          className="flex items-center justify-center gap-3 px-10 py-4 bg-white border border-slate-200 text-slate-900 font-black rounded-full hover:bg-slate-50 transition-all shadow-sm active:scale-95 text-xs uppercase tracking-widest"
        >
          <Download size={20} />
          Izvoz baze (JSON)
        </button>
      </header>

      <div className="bg-white rounded-[40px] border border-slate-200 shadow-lg shadow-slate-200/50 overflow-hidden">
        <div className="p-10 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-2 p-2 bg-slate-100 rounded-[28px]">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-10 py-4 rounded-[22px] text-xs font-bold uppercase tracking-[0.15em] transition-all ${
                activeTab === 'active'
                  ? 'bg-white text-[#0041F0] shadow-md'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Aktivni ({employees.filter((e) => e.isActive).length})
            </button>
            <button
              onClick={() => setActiveTab('archived')}
              className={`px-10 py-4 rounded-[22px] text-xs font-bold uppercase tracking-[0.15em] transition-all ${
                activeTab === 'archived'
                  ? 'bg-white text-[#0041F0] shadow-md'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Arhivirani (
              {employees.filter((e) => !e.isActive).length})
            </button>
          </div>
          <button
            onClick={() => {
              setEditingEmp(null);
              setFormData({
                name: '',
                email: '',
                carryOver: 0,
                currentYear: 20,
              });
              setShowAddForm(true);
            }}
            className="flex items-center gap-3 px-10 py-4 bg-[#0041F0] text-white font-black rounded-full hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 text-xs uppercase tracking-widest"
          >
            <UserPlus size={20} />
            Dodaj zaposlenika
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">
              <tr>
                <th className="px-12 py-7">Zaposlenik</th>
                <th className="px-12 py-7">Email adresa</th>
                <th className="px-12 py-7 text-center">Stari dani</th>
                <th className="px-12 py-7 text-center">Novi dani</th>
                <th className="px-12 py-7 text-right">Upravljanje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEmployees.map((emp) => (
                <tr
                  key={emp.id}
                  className="group hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-12 py-8 align-middle">
                    <div className="flex items-center gap-5">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black shadow-inner transition-all ${getInitialsBg(
                          emp.name
                        )}`}
                      >
                        {emp.name.charAt(0)}
                      </div>
                      <span className="font-bold text-slate-900 text-xl tracking-tight">
                        {emp.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-12 py-8 align-middle text-slate-500 font-semibold">
                    {emp.email}
                  </td>
                  <td className="px-12 py-8 align-middle text-center">
                    <span
                      className={`text-xl font-black ${
                        emp.daysCarryOver > 0
                          ? 'text-red-600'
                          : 'text-slate-200'
                      }`}
                    >
                      {emp.daysCarryOver}
                    </span>
                  </td>
                  <td className="px-12 py-8 align-middle text-center">
                    <span className="text-xl font-black text-[#0041F0]">
                      {emp.daysCurrentYear}
                    </span>
                  </td>
                  <td className="px-12 py-8 align-middle text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={() => startEdit(emp)}
                        className="p-3.5 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-[#0041F0] hover:border-[#0041F0] transition-all shadow-sm"
                      >
                        <Edit2 size={20} />
                      </button>
                      {emp.isActive ? (
                        <button
                          onClick={() =>
                            updateEmployee(emp.id, {
                              isActive: false,
                            })
                          }
                          className="p-3.5 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-orange-500 hover:border-orange-200 transition-all shadow-sm"
                          title="Arhiviraj"
                        >
                          <Archive size={20} />
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            updateEmployee(emp.id, { isActive: true })
                          }
                          className="p-3.5 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-emerald-500 hover:border-emerald-200 transition-all shadow-sm"
                          title="Aktiviraj"
                        >
                          <CheckCircle2 size={20} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-12 py-28 text-center">
                    <div className="flex flex-col items-center gap-6">
                      <div className="w-24 h-24 rounded-[40px] bg-slate-50 flex items-center justify-center text-slate-200 shadow-inner">
                        <Users size={48} />
                      </div>
                      <p className="text-slate-400 font-bold italic text-lg tracking-tight">
                        Nema zaposlenika za prikaz u ovoj kategoriji.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl z-[60] flex items-center justify-center p-6">
          <div className="bg-white rounded-[48px] w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden">
            <div className="p-12 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-4xl font-extrabold text-slate-900 tracking-tighter">
                {editingEmp ? 'Uredi profil' : 'Novi zaposlenik'}
              </h2>
              <button
                onClick={() => setShowAddForm(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400 hover:text-slate-900"
              >
                <X size={32} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-12 space-y-10">
              <div className="space-y-8">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
                    Puno ime i prezime
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        name: e.target.value,
                      })
                    }
                    className="w-full px-8 py-6 rounded-3xl border border-slate-200 bg-slate-50 hover:border-slate-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-600/20 focus:border-[#0041F0] transition-all font-medium text-lg text-slate-900 placeholder:text-slate-400 shadow-sm"
                    placeholder="npr. Marko Horvat"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
                    Email adresa
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        email: e.target.value,
                      })
                    }
                    className="w-full px-8 py-6 rounded-3xl border border-slate-200 bg-slate-50 hover:border-slate-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-600/20 focus:border-[#0041F0] transition-all font-medium text-lg text-slate-900 placeholder:text-slate-400 shadow-sm"
                    placeholder="marko.horvat@lexi.hr"
                  />
                </div>
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
                      Stari dani
                    </label>
                    <input
                      type="number"
                      value={formData.carryOver}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          carryOver: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full px-8 py-6 rounded-3xl border border-slate-200 bg-slate-50 hover:border-slate-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-600/20 focus:border-[#0041F0] transition-all font-medium text-lg text-slate-900 placeholder:text-slate-400 shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
                      Novi dani
                    </label>
                    <input
                      type="number"
                      value={formData.currentYear}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          currentYear: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full px-8 py-6 rounded-3xl border border-slate-200 bg-slate-50 hover:border-slate-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-600/20 focus:border-[#0041F0] transition-all font-medium text-lg text-slate-900 placeholder:text-slate-400 shadow-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-5 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 py-6 border-2 border-slate-100 font-black rounded-full text-slate-500 hover:text-slate-900 hover:border-slate-300 transition-all uppercase tracking-widest text-xs"
                >
                  Odustani
                </button>
                <button
                  type="submit"
                  className="flex-[2] py-6 bg-[#0041F0] text-white font-black rounded-full hover:bg-blue-700 shadow-2xl shadow-blue-200 transition-all uppercase tracking-widest text-xs"
                >
                  {editingEmp
                    ? 'Spremi promjene'
                    : 'Dodaj zaposlenika'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
