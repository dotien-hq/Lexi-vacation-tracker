'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Users, UserPlus, Edit2, Archive, Mail, Check, X, AlertCircle } from 'lucide-react';

interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  role: 'USER' | 'ADMIN';
  status: 'PENDING' | 'ACTIVE' | 'DEACTIVATED';
  daysCarryOver: number;
  daysCurrentYear: number;
  isActive: boolean; // Legacy field
  createdAt: string;
  updatedAt: string;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Invite form state
  const [inviteForm, setInviteForm] = useState({
    email: '',
    fullName: '',
    daysCarryOver: 0,
    daysCurrentYear: 20,
    role: 'USER' as 'USER' | 'ADMIN',
  });

  // Edit form state
  const [editForm, setEditForm] = useState({
    daysCarryOver: 0,
    daysCurrentYear: 0,
    isActive: true,
    role: 'USER' as 'USER' | 'ADMIN',
  });

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

  const fetchProfiles = useCallback(async () => {
    try {
      const response = await fetch('/api/profiles');
      if (response.ok) {
        const data = await response.json();
        setProfiles(data);
      } else {
        showMessage('error', 'Failed to fetch profiles');
      }
    } catch (error) {
      console.error('Failed to fetch profiles:', error);
      showMessage('error', 'An error occurred while fetching profiles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthorized) {
      fetchProfiles();
    }
  }, [fetchProfiles, isAuthorized]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      });

      if (response.ok) {
        const data = await response.json();
        showMessage(
          'success',
          `User invited successfully! ${data.inviteSent ? 'Invitation email sent.' : 'Email sending failed.'}`
        );
        setShowInviteForm(false);
        setInviteForm({
          email: '',
          fullName: '',
          daysCarryOver: 0,
          daysCurrentYear: 20,
          role: 'USER',
        });
        await fetchProfiles();
      } else {
        const error = await response.json();
        showMessage('error', error.error || 'Failed to invite user');
      }
    } catch (error) {
      console.error('Failed to invite user:', error);
      showMessage('error', 'An error occurred while inviting user');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingProfile) return;

    try {
      const response = await fetch(`/api/profiles/${editingProfile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (response.ok) {
        showMessage('success', 'Profile updated successfully!');
        setEditingProfile(null);
        await fetchProfiles();
      } else {
        const error = await response.json();
        showMessage('error', error.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      showMessage('error', 'An error occurred while updating profile');
    }
  };

  const handleArchive = async (profile: Profile) => {
    // Don't allow archiving PENDING users
    if (profile.status === 'PENDING') {
      showMessage('error', 'Cannot archive a user who has not yet accepted their invitation');
      return;
    }

    const newStatus = profile.status === 'ACTIVE' ? 'DEACTIVATED' : 'ACTIVE';
    const action = newStatus === 'DEACTIVATED' ? 'archive' : 'activate';

    if (!confirm(`Are you sure you want to ${action} ${profile.fullName || profile.email}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/profiles/${profile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          isActive: newStatus === 'ACTIVE', // Update legacy field too
        }),
      });

      if (response.ok) {
        showMessage('success', `Profile ${action}d successfully!`);
        await fetchProfiles();
      } else {
        const error = await response.json();
        showMessage('error', error.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Failed to archive profile:', error);
      showMessage('error', 'An error occurred while updating profile');
    }
  };

  const startEdit = (profile: Profile) => {
    setEditingProfile(profile);
    setEditForm({
      daysCarryOver: profile.daysCarryOver,
      daysCurrentYear: profile.daysCurrentYear,
      isActive: profile.isActive,
      role: profile.role,
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
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">User Management</h1>
          <p className="text-slate-500 mt-2 font-medium">
            Manage user profiles, vacation balances, and access.
          </p>
        </div>
        <button
          onClick={() => setShowInviteForm(true)}
          className="flex items-center gap-2 px-6 py-3 bg-[#0041F0] text-white rounded-full text-sm font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
        >
          <UserPlus size={18} strokeWidth={3} />
          Invite User
        </button>
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

      {/* Invite User Modal */}
      {showInviteForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[24px] shadow-2xl max-w-md w-full p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Invite New User</h2>
              <button
                onClick={() => setShowInviteForm(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  required
                  placeholder="user@example.com"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                <input
                  type="text"
                  value={inviteForm.fullName}
                  onChange={(e) => setInviteForm({ ...inviteForm, fullName: e.target.value })}
                  placeholder="John Doe"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Role</label>
                <select
                  value={inviteForm.role}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, role: e.target.value as 'USER' | 'ADMIN' })
                  }
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="USER">User</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Carry-Over Days
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={inviteForm.daysCarryOver}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, daysCarryOver: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Current Year Days
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={inviteForm.daysCurrentYear}
                    onChange={(e) =>
                      setInviteForm({
                        ...inviteForm,
                        daysCurrentYear: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowInviteForm(false)}
                  className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-[#0041F0] text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {editingProfile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[24px] shadow-2xl max-w-md w-full p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Edit Profile</h2>
              <button
                onClick={() => setEditingProfile(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="mb-6 p-4 bg-slate-50 rounded-lg">
              <p className="font-bold text-slate-900">{editingProfile.fullName || 'No name'}</p>
              <p className="text-sm text-slate-600">{editingProfile.email}</p>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) =>
                    setEditForm({ ...editForm, role: e.target.value as 'USER' | 'ADMIN' })
                  }
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="USER">User</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Carry-Over Days
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.daysCarryOver}
                    onChange={(e) =>
                      setEditForm({ ...editForm, daysCarryOver: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Current Year Days
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.daysCurrentYear}
                    onChange={(e) =>
                      setEditForm({ ...editForm, daysCurrentYear: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingProfile(null)}
                  className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-[#0041F0] text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Profiles List */}
      <section className="bg-white rounded-[24px] border border-slate-200 shadow-lg shadow-slate-200/50 overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex items-center gap-3">
          <Users className="text-[#0041F0]" size={24} strokeWidth={2} />
          <h2 className="text-2xl font-bold text-slate-900">All Users</h2>
          <span className="ml-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-black">
            {profiles.length}
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className={`p-6 hover:bg-slate-50/50 transition-colors ${
                profile.status === 'DEACTIVATED' ? 'opacity-50' : ''
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg">
                    {(profile.fullName || profile.email).charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-bold text-slate-900">
                        {profile.fullName || 'No name'}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-black ${
                          profile.role === 'ADMIN'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {profile.role}
                      </span>
                      {profile.status === 'PENDING' && (
                        <span className="px-2 py-0.5 rounded text-xs font-black bg-yellow-100 text-yellow-700 flex items-center gap-1">
                          <Mail size={12} />
                          Pending Invitation
                        </span>
                      )}
                      {profile.status === 'DEACTIVATED' && (
                        <span className="px-2 py-0.5 rounded text-xs font-black bg-red-100 text-red-700 flex items-center gap-1">
                          <Archive size={12} />
                          Archived
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Mail size={14} />
                      {profile.email}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div
                      className={`p-3 rounded-lg text-center ${
                        profile.daysCarryOver > 0
                          ? 'bg-red-50 border border-red-100'
                          : 'bg-slate-50'
                      }`}
                    >
                      <div className="text-xs font-black uppercase tracking-wider text-slate-400 mb-1">
                        Carry-Over
                      </div>
                      <div className="flex items-center justify-center gap-1">
                        <span
                          className={`text-lg font-black ${
                            profile.daysCarryOver > 0 ? 'text-red-700' : 'text-slate-400'
                          }`}
                        >
                          {profile.daysCarryOver}
                        </span>
                        {profile.daysCarryOver > 0 && (
                          <AlertCircle className="text-red-500" size={14} />
                        )}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 text-center">
                      <div className="text-xs font-black uppercase tracking-wider text-blue-600/50 mb-1">
                        Current
                      </div>
                      <span className="text-lg font-black text-[#0041F0]">
                        {profile.daysCurrentYear}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(profile)}
                      className="p-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-all"
                      title="Edit balances"
                    >
                      <Edit2 size={18} />
                    </button>
                    {profile.status !== 'PENDING' && (
                      <button
                        onClick={() => handleArchive(profile)}
                        className={`p-2 border rounded-lg transition-all ${
                          profile.status === 'ACTIVE'
                            ? 'border-slate-200 text-slate-600 hover:bg-slate-50'
                            : 'border-green-200 text-green-600 hover:bg-green-50'
                        }`}
                        title={profile.status === 'ACTIVE' ? 'Archive user' : 'Activate user'}
                      >
                        {profile.status === 'ACTIVE' ? <Archive size={18} /> : <Check size={18} />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {profiles.length === 0 && (
            <div className="p-12 text-center text-slate-400">
              <Users size={48} className="mx-auto mb-4 opacity-50" />
              <p className="font-medium">No users found</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
