'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutGrid, Calendar, Users, FileText } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, loading } = useAuth();

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
  const isAdmin = profile?.role === 'ADMIN';
  const navItems = isAdmin ? [...baseNavItems, ...adminNavItems] : baseNavItems;

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
            {!loading && profile && (
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
