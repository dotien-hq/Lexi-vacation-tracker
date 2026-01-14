import Link from 'next/link';
import { AlertCircle, Mail, ArrowLeft } from 'lucide-react';

export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-[24px] shadow-lg p-8 text-center">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="bg-red-100 rounded-full p-4">
              <AlertCircle className="w-12 h-12 text-red-600" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Access Denied</h1>

          {/* Message */}
          <p className="text-slate-600 mb-6 leading-relaxed">
            Your account is not authorized to access this application. This system is invite-only.
          </p>

          <p className="text-slate-600 mb-8 leading-relaxed">
            If you believe this is an error or you need access, please contact your system
            administrator.
          </p>

          {/* Contact Information */}
          <div className="bg-slate-50 rounded-[16px] p-4 mb-6">
            <div className="flex items-center justify-center gap-2 text-slate-700">
              <Mail className="w-5 h-5" />
              <span className="text-sm font-medium">Support Contact</span>
            </div>
            <p className="text-slate-600 text-sm mt-2">
              Contact your administrator to request access
            </p>
          </div>

          {/* Back to Login Button */}
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-[#0041F0] text-white px-6 py-3 rounded-[12px] hover:bg-blue-700 transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </Link>
        </div>

        {/* Additional Help Text */}
        <p className="text-center text-slate-500 text-sm mt-6">
          Need help? Contact your organization&apos;s administrator for assistance.
        </p>
      </div>
    </div>
  );
}
