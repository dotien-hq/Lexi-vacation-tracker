import { describe, it, expect } from 'vitest';
import { generateInvitationToken, hashToken, verifyToken } from '../tokens';

describe('token utilities', () => {
  describe('generateInvitationToken', () => {
    it('should generate a 32-character token', () => {
      const token = generateInvitationToken();
      expect(token).toHaveLength(32);
    });

    it('should generate unique tokens', () => {
      const token1 = generateInvitationToken();
      const token2 = generateInvitationToken();
      expect(token1).not.toBe(token2);
    });

    it('should only contain alphanumeric characters', () => {
      const token = generateInvitationToken();
      expect(token).toMatch(/^[a-zA-Z0-9]+$/);
    });
  });

  describe('hashToken', () => {
    it('should hash a token consistently', () => {
      const token = 'test-token-123';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different tokens', () => {
      const hash1 = hashToken('token-1');
      const hash2 = hashToken('token-2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const token = 'test-token-123';
      const hash = hashToken(token);
      expect(verifyToken(token, hash)).toBe(true);
    });

    it('should reject an invalid token', () => {
      const hash = hashToken('correct-token');
      expect(verifyToken('wrong-token', hash)).toBe(false);
    });
  });
});
