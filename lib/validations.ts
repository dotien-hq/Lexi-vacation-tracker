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
export const createRequestSchema = z
  .object({
    startDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
      message: 'Invalid start date format',
    }),
    endDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
      message: 'Invalid end date format',
    }),
    notes: z.string().optional(),
  })
  .refine(
    (data) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      return end >= start;
    },
    { message: 'End date must be after or equal to start date', path: ['endDate'] }
  );

export const updateRequestStatusSchema = z.object({
  status: z.enum(['REQUESTED', 'APPROVED', 'DENIED']),
  rejectionReason: z.string().optional(),
});

export const updateRequestDatesSchema = z
  .object({
    startDate: z
      .string()
      .refine((date) => !isNaN(Date.parse(date)), {
        message: 'Invalid start date format',
      })
      .optional(),
    endDate: z
      .string()
      .refine((date) => !isNaN(Date.parse(date)), {
        message: 'Invalid end date format',
      })
      .optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        return end >= start;
      }
      return true;
    },
    { message: 'End date must be after or equal to start date', path: ['endDate'] }
  );

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
