'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle, CalendarDays, Clock, Send, CheckCircle, XCircle, User } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase';
import { calculateBusinessDays } from '@/lib/holidayCalculator';
import { calculateAvailableDays, hasSufficientBalance } from '@/lib/vacationBalance';

interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  role: 'USER' | 'ADMIN';
  daysCarryOver: number;
  daysCurrentYear: number;
  isActive: boolean;
}

interface LeaveRequest {
  id: string;
  profileId: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  status: 'REQUESTED' | 'APPROVED' | 'DENIED';
  rejectionReason: string | null;
  createdAt: string;
  profile?: {
    id: string;
    email: string;
    fullName: string | null;
  };
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [calculatedDays, setCalculatedDays] = useState<number | null>(null);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // Calculate business days when dates change
    if (startDate && endDate) {
      try {
        const days = calculateBusinessDays(startDate, endDate);
        setCalculatedDays(days);
        setFormError('');
      } catch {
        setCalculatedDays(null);
        setFormError('Invalid date range');
      }
    } else {
      setCalculatedDays(null);
    }
  }, [startDate, endDate]);

  const fetchData = async () => {
    try {
      const supabase = createBrowserClient();

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = '/login';
        return;
      }

      // Fetch profile and requests
      const [profileRes, requestsRes] = await Promise.all([
        fetch('/api/profile/me'),
        fetch('/api/requests'),
      ]);

      if (!profileRes.ok || !requestsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const profileData = await profileRes.json();
      const requestsData = await requestsRes.json();

      setProfile(profileData);
      setRequests(requestsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!startDate || !endDate) {
      setFormError('Please select both start and end dates');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setFormError('End date must be after start date');
      return;
    }

    if (!profile || calculatedDays === null) {
      return;
    }

    // Client-side balance validation
    if (!hasSufficientBalance(profile, calculatedDays)) {
      setFormError(
        `Insufficient vacation days. Available: ${calculateAvailableDays(profile)}, Requested: ${calculatedDays}`
      );
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit request');
      }

      // Reset form and refresh data
      setStartDate('');
      setEndDate('');
      setCalculatedDays(null);
      await fetchData();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-500">Profile not found</div>
      </div>
    );
  }

  const totalAvailable = calculateAvailableDays(profile);
  const hasCarryOver = profile.daysCarryOver > 0;
  const isSubmitDisabled =
    !startDate ||
    !endDate ||
    calculatedDays === null ||
    calculatedDays <= 0 ||
    !hasSufficientBalance(profile, calculatedDays) ||
    submitting;

  // Get today's date for min date validation
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      <header>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Dashboard</h1>
        <p className="text-slate-500 mt-2 font-medium">
          Welcome back, {profile.fullName || profile.email}
        </p>
      </header>

      {/* Vacation Balance Section */}
      <section className="bg-white rounded-[24px] border border-slate-200 shadow-lg shadow-slate-200/50 p-8">
        <div className="flex items-center gap-3 mb-6">
          <CalendarDays className="text-[#0041F0]" size={24} strokeWidth={2} />
          <h2 className="text-2xl font-bold text-slate-900">Vacation Balance</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Carry-over days */}
          <div
            className={`p-6 rounded-2xl flex flex-col items-center justify-center transition-all ${
              hasCarryOver
                ? 'bg-red-50 border-2 border-red-200'
                : 'bg-slate-50 border-2 border-slate-100'
            }`}
          >
            <span className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
              Carry-Over Days
            </span>
            <div className="flex items-center gap-2">
              <span
                className={`text-3xl font-black ${
                  hasCarryOver ? 'text-red-700' : 'text-slate-400'
                }`}
              >
                {profile.daysCarryOver}
              </span>
              {hasCarryOver && <AlertCircle className="text-red-500" size={20} strokeWidth={2} />}
            </div>
          </div>

          {/* Current year days */}
          <div className="p-6 rounded-2xl bg-blue-50 border-2 border-blue-200 flex flex-col items-center justify-center">
            <span className="text-xs font-black uppercase tracking-widest text-[#0041F0]/50 mb-2">
              Current Year Days
            </span>
            <span className="text-3xl font-black text-[#0041F0]">{profile.daysCurrentYear}</span>
          </div>

          {/* Total available */}
          <div className="p-6 rounded-2xl bg-slate-900 border-2 border-slate-800 flex flex-col items-center justify-center">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
              Total Available
            </span>
            <span className="text-3xl font-black text-white">{totalAvailable}</span>
          </div>
        </div>

        {/* Carry-over warning */}
        {hasCarryOver && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} strokeWidth={2} />
            <div>
              <p className="text-sm font-bold text-red-900">Carry-over days expire June 30</p>
              <p className="text-xs text-red-700 mt-1">
                You have {profile.daysCarryOver} carry-over days from last year. Use them before
                June 30 or they will be lost.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Leave Request Submission Form */}
      <section className="bg-white rounded-[24px] border border-slate-200 shadow-lg shadow-slate-200/50 p-8">
        <div className="flex items-center gap-3 mb-6">
          <Send className="text-[#0041F0]" size={24} strokeWidth={2} />
          <h2 className="text-2xl font-bold text-slate-900">Request Time Off</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Start Date */}
            <div>
              <label htmlFor="startDate" className="block text-sm font-bold text-slate-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                id="startDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={today}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0041F0] focus:border-transparent"
              />
            </div>

            {/* End Date */}
            <div>
              <label htmlFor="endDate" className="block text-sm font-bold text-slate-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                id="endDate"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || today}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0041F0] focus:border-transparent"
              />
            </div>
          </div>

          {/* Business Days Preview */}
          {calculatedDays !== null && calculatedDays > 0 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-sm font-bold text-blue-900">
                Business days: <span className="text-xl">{calculatedDays}</span>
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Excludes weekends and Croatian public holidays
              </p>
            </div>
          )}

          {/* Error Message */}
          {formError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle
                className="text-red-500 flex-shrink-0 mt-0.5"
                size={20}
                strokeWidth={2}
              />
              <p className="text-sm font-bold text-red-900">{formError}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className={`w-full flex items-center justify-center gap-2 px-8 py-4 rounded-full text-sm font-black transition-all ${
              isSubmitDisabled
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-[#0041F0] text-white hover:bg-blue-700 shadow-lg shadow-blue-200'
            }`}
          >
            <Send size={18} strokeWidth={3} />
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      </section>

      {/* Request History */}
      <section className="bg-white rounded-[24px] border border-slate-200 shadow-lg shadow-slate-200/50 overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex items-center gap-3">
          <Clock className="text-[#0041F0]" size={24} strokeWidth={2} />
          <h2 className="text-2xl font-bold text-slate-900">Request History</h2>
        </div>

        {requests.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No leave requests yet. Submit your first request above!
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {requests
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((request) => (
                <div key={request.id} className="p-6 hover:bg-slate-50/50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-black ${
                            request.status === 'REQUESTED'
                              ? 'bg-orange-100 text-orange-700'
                              : request.status === 'APPROVED'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {request.status}
                        </span>
                        <span className="text-sm font-medium text-slate-500">
                          {new Date(request.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      {profile.role === 'ADMIN' && request.profile && (
                        <p className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-1">
                          <User size={16} className="text-slate-400" />
                          {request.profile.fullName || request.profile.email}
                        </p>
                      )}
                      <p className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <CalendarDays size={16} className="text-slate-400" />
                        {new Date(request.startDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        —{' '}
                        {new Date(request.endDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                      {request.rejectionReason && (
                        <p className="text-sm text-red-700 mt-2 flex items-start gap-2">
                          <XCircle size={16} className="flex-shrink-0 mt-0.5" />
                          <span>
                            <strong>Reason:</strong> {request.rejectionReason}
                          </span>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {request.status === 'APPROVED' && (
                        <CheckCircle className="text-green-500" size={20} strokeWidth={2} />
                      )}
                      {request.status === 'DENIED' && (
                        <XCircle className="text-red-500" size={20} strokeWidth={2} />
                      )}
                      <span className="text-lg font-black text-slate-900">
                        {request.daysCount} days
                      </span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
