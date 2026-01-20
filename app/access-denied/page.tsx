import Link from 'next/link';

export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Pristup odbijen
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Nemate dozvolu za pristup ovoj stranici.
          </p>
        </div>

        <div className="mt-8">
          <Link href="/dashboard" className="text-indigo-600 hover:text-indigo-500 font-medium">
            Povratak na Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
