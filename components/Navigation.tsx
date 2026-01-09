'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Calendar, Settings } from 'lucide-react';

export default function Navigation() {
  const pathname = usePathname();

  const navItems = [
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: <LayoutGrid size={18} />,
    },
    {
      path: '/calendar',
      label: 'Kalendar',
      icon: <Calendar size={18} />,
    },
    {
      path: '/settings',
      label: 'Admin',
      icon: <Settings size={18} />,
    },
  ];

  return (
    <header className="bg-white border-b border-slate-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center">
            <span className="text-2xl font-black text-slate-900 tracking-tight">LEXI</span>
            <span className="mx-3 text-slate-300 font-light text-2xl">|</span>
            <span className="text-xl font-medium text-slate-500">Godišnji</span>
          </div>
          <nav className="flex space-x-6">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-bold transition-all duration-200 ${
                  pathname === item.path ? 'text-[#0041F0]' : 'text-slate-500 hover:text-[#0041F0]'
                }`}
              >
                <span className={pathname === item.path ? 'text-[#0041F0]' : 'text-slate-400'}>
                  {item.icon}
                </span>
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
