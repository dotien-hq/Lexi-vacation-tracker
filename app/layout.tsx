import type { Metadata } from 'next';
import './globals.css';
import Navigation from '../components/Navigation';

export const metadata: Metadata = {
  title: 'Lexi Vacation Tracker',
  description: 'Croatian vacation/leave management system',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hr">
      <body
        style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}
        className="min-h-screen flex flex-col selection:bg-blue-100 selection:text-blue-900"
      >
        <Navigation />
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
          {children}
        </main>
        <footer className="bg-white border-t border-slate-100 py-8 text-center text-sm font-medium text-slate-400">
          &copy; {new Date().getFullYear()} Lexi &bull; Croatian Vacation Tracker
        </footer>
      </body>
    </html>
  );
}
