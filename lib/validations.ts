import { z } from 'zod';

// Auth schemas
export const completeInviteSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const passwordResetSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .transform((e) => e.trim().toLowerCase()),
});

// Profile schemas
export const createProfileSchema = z.object({
  email: z.string().email('Invalid email address'),
  fullName: z.string().optional().nullable(),
  role: z.enum(['USER', 'ADMIN']).optional().default('USER'),
  daysCarryOver: z.number().int().min(0, 'Days must be non-negative').optional().default(0),
  daysCurrentYear: z.number().int().min(0, 'Days must be non-negative').optional().default(20),
});

export const updateProfileSchema = z.object({
  daysCarryOver: z.number().int().min(0, 'Days must be non-negative').optional(),
  daysCurrentYear: z.number().int().min(0, 'Days must be non-negative').optional(),
  isActive: z.boolean().optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
  status: z.enum(['PENDING', 'ACTIVE', 'DEACTIVATED']).optional(),
});

// Request schemas

export const MAX_LEAVE_SPAN_DAYS = 366;
const MS_PER_DAY = 86_400_000;

/**
 * Calendar date as plain YYYY-MM-DD. Timestamps and offsets are rejected so every
 * stored date is UTC midnight (chip placement, "unchanged" detection and the modal's
 * date inputs all depend on that). Year range bounds the day-by-day loop in
 * calculateBusinessDays.
 */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format' })
  .refine((d) => !isNaN(Date.parse(d)), { message: 'Invalid date' })
  .refine(
    (d) => {
      const year = Number(d.slice(0, 4));
      return year >= 2020 && year <= 2100;
    },
    { message: 'Date out of range' }
  );

const withinSpan = (start: string, end: string) =>
  (Date.parse(end) - Date.parse(start)) / MS_PER_DAY <= MAX_LEAVE_SPAN_DAYS;

export const createRequestSchema = z
  .object({
    startDate: isoDate,
    endDate: isoDate,
    notes: z.string().optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'End date must be after or equal to start date',
    path: ['endDate'],
  })
  .refine((data) => withinSpan(data.startDate, data.endDate), {
    message: `Leave cannot span more than ${MAX_LEAVE_SPAN_DAYS} days`,
    path: ['endDate'],
  });

export const updateRequestStatusSchema = z.object({
  // REQUESTED is deliberately excluded: it is only reachable via a date change (reschedule)
  status: z.enum(['APPROVED', 'DENIED', 'CANCELLED']),
  rejectionReason: z
    .string()
    .trim()
    .max(500, { message: 'Reason must be 500 characters or fewer' })
    .optional(),
});

export const updateRequestDatesSchema = z
  .object({
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
  })
  .refine((data) => !data.startDate || !data.endDate || data.endDate >= data.startDate, {
    message: 'End date must be after or equal to start date',
    path: ['endDate'],
  })
  .refine((data) => !data.startDate || !data.endDate || withinSpan(data.startDate, data.endDate), {
    message: `Leave cannot span more than ${MAX_LEAVE_SPAN_DAYS} days`,
    path: ['endDate'],
  });

// Helper to parse and validate request body
export async function parseBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; error: z.ZodError }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, error: result.error };
  } catch {
    return {
      success: false,
      error: new z.ZodError([
        {
          code: 'custom',
          path: [],
          message: 'Invalid JSON body',
        },
      ]),
    };
  }
}

// Helper to create validation error response
export function validationError(error: z.ZodError) {
  return {
    error: 'Validation failed',
    details: error.flatten(),
  };
}

// Type exports for use in routes
export type CompleteInviteInput = z.infer<typeof completeInviteSchema>;
export type PasswordResetInput = z.infer<typeof passwordResetSchema>;
export type CreateProfileInput = z.infer<typeof createProfileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateRequestInput = z.infer<typeof createRequestSchema>;
export type UpdateRequestStatusInput = z.infer<typeof updateRequestStatusSchema>;
export type UpdateRequestDatesInput = z.infer<typeof updateRequestDatesSchema>;
