// Enums matching Prisma schema
export enum Role {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export enum RequestStatus {
  REQUESTED = 'REQUESTED',
  APPROVED = 'APPROVED',
  DENIED = 'DENIED',
}

// Profile model (replaces Employee)
export interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  role: Role;
  daysCarryOver: number;
  daysCurrentYear: number;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// LeaveRequest model (updated to use profileId)
export interface LeaveRequest {
  id: string;
  profileId: string;
  startDate: Date | string;
  endDate: Date | string;
  daysCount: number;
  status: RequestStatus;
  rejectionReason: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}
