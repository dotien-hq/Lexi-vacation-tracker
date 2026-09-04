import type { RequestStatusValue } from '@/types';
import { REQUEST_STATUS_META } from '@/lib/requestStatus';

interface RequestStatusBadgeProps {
  status: RequestStatusValue;
  className?: string;
}

export default function RequestStatusBadge({ status, className = '' }: RequestStatusBadgeProps) {
  const meta = REQUEST_STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black ${meta.badge} ${className}`}
    >
      {meta.label}
    </span>
  );
}
