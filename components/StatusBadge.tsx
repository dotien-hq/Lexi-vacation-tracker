interface StatusBadgeProps {
  status: 'PENDING' | 'ACTIVE' | 'DEACTIVATED';
  className?: string;
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const styles = {
    PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    ACTIVE: 'bg-green-100 text-green-800 border-green-200',
    DEACTIVATED: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  const labels = {
    PENDING: 'Pending',
    ACTIVE: 'Active',
    DEACTIVATED: 'Deactivated',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
        styles[status]
      } ${className}`}
    >
      {labels[status]}
    </span>
  );
}
