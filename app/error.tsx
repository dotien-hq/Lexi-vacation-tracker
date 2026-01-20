'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console (replace with Sentry in future)
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Došlo je do greške</h2>
        <p className="text-slate-600 mb-6">Nešto je pošlo po zlu. Molimo pokušajte ponovno.</p>
        <button
          onClick={reset}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Pokušaj ponovno
        </button>
      </div>
    </div>
  );
}
