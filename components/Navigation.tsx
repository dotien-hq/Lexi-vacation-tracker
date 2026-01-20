'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutGrid, Calendar, Users, FileText } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase';

type UserRole = 'USER' | 'ADMIN' | null;

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUserProfile() {
      try {
        const supabase = createBrowserClient();

        // Get the current session
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          setUserRole(null);
          setLoading(false);
          return;
        }

        // Fetch the user's profile using the API endpoint
        const response = await fetch('/api/profile/me');

        if (!response.ok) {
          console.error('Error fetching user profile:', response.statusText);
          setUserRole(null);
        } else {
          const profile = await response.json();
          setUserRole(profile?.role || null);
        }
      } catch (error) {
        console.error('Error in fetchUserProfile:', error);
        setUserRole(null);
      } finally {
        setLoading(false);
      }
    }

    fetchUserProfile();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Base navigation items for all authenticated users
  const baseNavItems = [
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: <LayoutGrid size={18} />,
    },
  ];

  // Admin-only navigation items
  const adminNavItems = [
    {
      path: '/admin/users',
      label: 'Users',
      icon: <Users size={18} />,
    },
    {
      path: '/admin/requests',
      label: 'Requests',
      icon: <FileText size={18} />,
    },
    {
      path: '/admin/calendar',
      label: 'Calendar',
      icon: <Calendar size={18} />,
    },
  ];

  // Determine which nav items to show based on role
  const navItems = userRole === 'ADMIN' ? [...baseNavItems, ...adminNavItems] : baseNavItems;

  return (
    <header className="bg-white border-b border-slate-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <Link
            href="/dashboard"
            className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
          >
            <span className="text-2xl font-black text-slate-900 tracking-tight">LEXI</span>
            <span className="mx-3 text-slate-300 font-light text-2xl">|</span>
            <span className="text-xl font-medium text-slate-500">Godišnji</span>
          </Link>
          <nav className="flex space-x-6">
            {!loading &&
              navItems.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-bold transition-all duration-200 ${
                    pathname === item.path || pathname.startsWith(item.path)
                      ? 'text-[#0041F0]'
                      : 'text-slate-500 hover:text-[#0041F0]'
                  }`}
                >
                  <span
                    className={
                      pathname === item.path || pathname.startsWith(item.path)
                        ? 'text-[#0041F0]'
                        : 'text-slate-400'
                    }
                  >
                    {item.icon}
                  </span>
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              ))}
            {!loading && userRole && (
              <button
                onClick={handleLogout}
                className="text-slate-500 hover:text-[#0041F0] px-3 py-2 text-sm font-bold transition-all duration-200"
              >
                Odjavi se
              </button>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
