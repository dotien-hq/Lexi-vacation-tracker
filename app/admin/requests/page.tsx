'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, CheckCircle, XCircle, Calendar, User, Clock, X } from 'lucide-react';

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
  rejectionReason: string | null;
  createdAt: string;
  profile: Profile;
}

export default function AdminRequestsPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDenyModal, setShowDenyModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

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
      const response = await fetch('/api/requests?status=REQUESTED');
      if (response.ok) {
        const data = await response.json();
        setRequests(data);
      } else {
        showMessage('error', 'Failed to fetch requests');
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error);
      showMessage('error', 'An error occurred while fetching requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthorized) {
      fetchRequests();
    }
  }, [fetchRequests, isAuthorized]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleApprove = async (request: LeaveRequest) => {
    if (
      !confirm(`Approve leave request for ${request.profile.fullName || request.profile.email}?`)
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' }),
      });

      if (response.ok) {
        showMessage('success', 'Request approved successfully!');
        await fetchRequests();
      } else {
        const error = await response.json();
        showMessage('error', error.error || 'Failed to approve request');
      }
    } catch (error) {
      console.error('Failed to approve request:', error);
      showMessage('error', 'An error occurred while approving request');
    }
  };

  const openDenyModal = (request: LeaveRequest) => {
    setSelectedRequest(request);
    setRejectionReason('');
    setShowDenyModal(true);
  };

  const handleDeny = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedRequest) return;

    if (!rejectionReason.trim()) {
      showMessage('error', 'Rejection reason is required');
      return;
    }

    try {
      const response = await fetch(`/api/requests/${selectedRequest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'DENIED',
          rejectionReason: rejectionReason.trim(),
        }),
      });

      if (response.ok) {
        showMessage('success', 'Request denied successfully!');
        setShowDenyModal(false);
        setSelectedRequest(null);
        setRejectionReason('');
        await fetchRequests();
      } else {
        const error = await response.json();
        showMessage('error', error.error || 'Failed to deny request');
      }
    } catch (error) {
      console.error('Failed to deny request:', error);
      showMessage('error', 'An error occurred while denying request');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
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
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
          Request Management
        </h1>
        <p className="text-slate-500 mt-2 font-medium">
          Review and approve or deny pending leave requests.
        </p>
      </header>

      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Deny Modal */}
      {showDenyModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[24px] shadow-2xl max-w-md w-full p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Deny Request</h2>
              <button
                onClick={() => setShowDenyModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="mb-6 p-4 bg-slate-50 rounded-lg">
              <p className="font-bold text-slate-900">
                {selectedRequest.profile.fullName || selectedRequest.profile.email}
              </p>
              <p className="text-sm text-slate-600">
                {formatDate(selectedRequest.startDate)} - {formatDate(selectedRequest.endDate)}
              </p>
              <p className="text-sm text-slate-600 mt-1">
                {selectedRequest.daysCount} business day{selectedRequest.daysCount !== 1 ? 's' : ''}
              </p>
            </div>

            <form onSubmit={handleDeny} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Rejection Reason *
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  required
                  rows={4}
                  placeholder="Please provide a reason for denying this request..."
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowDenyModal(false)}
                  className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-all"
                >
                  Deny Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Requests List */}
      <section className="bg-white rounded-[24px] border border-slate-200 shadow-lg shadow-slate-200/50 overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex items-center gap-3">
          <ClipboardList className="text-[#0041F0]" size={24} strokeWidth={2} />
          <h2 className="text-2xl font-bold text-slate-900">Pending Requests</h2>
          <span className="ml-2 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-black">
            {requests.length}
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {requests.map((request) => (
            <div key={request.id} className="p-6 hover:bg-slate-50/50 transition-colors">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-12 h-12 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-lg">
                    {(request.profile.fullName || request.profile.email).charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-slate-900">
                        {request.profile.fullName || 'No name'}
                      </h3>
                      <span className="px-2 py-0.5 rounded text-xs font-black bg-orange-100 text-orange-700">
                        PENDING
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <User size={14} />
                        {request.profile.email}
                      </div>

                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Calendar size={14} />
                        {formatDate(request.startDate)} - {formatDate(request.endDate)}
                      </div>

                      <div className="flex items-center gap-2 text-sm font-bold text-[#0041F0]">
                        <Clock size={14} />
                        {request.daysCount} business day{request.daysCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleApprove(request)}
                    className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition-all shadow-md"
                  >
                    <CheckCircle size={18} strokeWidth={2.5} />
                    Approve
                  </button>
                  <button
                    onClick={() => openDenyModal(request)}
                    className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-all shadow-md"
                  >
                    <XCircle size={18} strokeWidth={2.5} />
                    Deny
                  </button>
                </div>
              </div>
            </div>
          ))}

          {requests.length === 0 && (
            <div className="p-12 text-center text-slate-400">
              <ClipboardList size={48} className="mx-auto mb-4 opacity-50" />
              <p className="font-medium">No pending requests</p>
              <p className="text-sm mt-2">All leave requests have been processed.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
