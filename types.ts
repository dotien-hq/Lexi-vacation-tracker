
export enum LeaveStatus {
  REQUESTED = 'REQUESTED',
  APPROVED = 'APPROVED',
  DENIED = 'DENIED'
}

export interface Employee {
  id: number;
  name: string;
  email: string;
  daysCarryOver: number;
  daysCurrentYear: number;
  isActive: boolean;
}

export interface LeaveRequest {
  id: number;
  employeeId: number;
  startDate: string;
  endDate: string;
  daysCount: number;
  status: LeaveStatus;
  createdAt: string;
}

export interface AppData {
  employees: Employee[];
  requests: LeaveRequest[];
}
