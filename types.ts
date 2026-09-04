// Enums matching Prisma schema
export enum Role {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export enum RequestStatus {
  REQUESTED = 'REQUESTED',
  APPROVED = 'APPROVED',
  DENIED = 'DENIED',
  CANCELLED = 'CANCELLED',
}

/**
 * String-literal union of RequestStatus.
 * Assignable from BOTH this TS enum and Prisma's generated enum, so shared
 * logic (lib/requestTransitions.ts) can be used by API routes and client code.
 */
export type RequestStatusValue = `${RequestStatus}`;

/** Shape returned by GET/PATCH /api/requests* (dates are ISO strings over JSON). */
export interface LeaveRequestWithProfile {
  id: string;
  profileId: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  status: RequestStatusValue;
  rejectionReason: string | null;
  createdAt: string;
  profile: {
    id: string;
    email: string;
    fullName: string | null;
  };
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
