import crypto from 'crypto';

/**
 * Generate a cryptographically secure invitation token
 * @returns 32-character alphanumeric token
 */
export function generateInvitationToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Hash a token for secure storage
 * @param token The token to hash
 * @returns SHA-256 hash of the token
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Verify a token against its hash
 * @param token The token to verify
 * @param hash The stored hash
 * @returns true if token matches hash
 */
export function verifyToken(token: string, hash: string): boolean {
  const tokenHash = hashToken(token);
  return crypto.timingSafeEqual(Buffer.from(tokenHash), Buffer.from(hash));
}

/**
 * Generate invitation expiry date (7 days from now)
 * @returns Date object 7 days in the future
 */
export function generateInvitationExpiry(): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 7);
  return expiry;
}

/**
 * Check if invitation token has expired
 * @param expiresAt The expiration date
 * @returns true if expired
 */
export function isTokenExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return true;
  return new Date() > expiresAt;
}
