import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { query, queryOne } from '../../db/index.js';

const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS       = 5;
const RATE_LIMIT_WINDOW  = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX     = 3;         // 3 OTPs per minute per email

// ── Generate a 6-digit OTP ────────────────────────────────────────────────────
export function generateOTP(): string {
  return String(crypto.randomInt(100000, 999999));
}

// ── Rate limit check ──────────────────────────────────────────────────────────
export async function checkRateLimit(identifier: string, action: string, max = RATE_LIMIT_MAX, windowMs = RATE_LIMIT_WINDOW): Promise<{ allowed: boolean; retryAfter?: number }> {
  const windowStart = new Date(Date.now() - windowMs).toISOString();
  const rows = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM rate_limit_log WHERE identifier=$1 AND action=$2 AND created_at > $3',
    [identifier, action, windowStart]
  );
  const count = parseInt((rows[0] as any)?.count ?? '0');
  if (count >= max) {
    return { allowed: false, retryAfter: Math.ceil(windowMs / 1000) };
  }
  await query('INSERT INTO rate_limit_log (identifier, action) VALUES ($1, $2)', [identifier, action]);
  return { allowed: true };
}

// ── Send OTP (creates record, returns code for email dispatch) ─────────────────
export async function createOTP(email: string, purpose: 'registration' | 'password_reset' | 'email_change'): Promise<string> {
  // Invalidate previous OTPs for this email+purpose
  await query(
    "DELETE FROM email_verifications WHERE email=$1 AND purpose=$2 AND verified=false",
    [email.toLowerCase(), purpose]
  );
  const otp = generateOTP();
  const hash = await bcrypt.hash(otp, 10);
  await query(
    'INSERT INTO email_verifications (email, otp_hash, purpose, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL \'10 minutes\')',
    [email.toLowerCase(), hash, purpose]
  );
  return otp;
}

// ── Verify OTP ────────────────────────────────────────────────────────────────
export async function verifyOTP(email: string, otp: string, purpose: string): Promise<{ valid: boolean; error?: string }> {
  const record = await queryOne<{
    id: string; otp_hash: string; attempts: number; expires_at: string; verified: boolean;
  }>(
    "SELECT * FROM email_verifications WHERE email=$1 AND purpose=$2 AND verified=false ORDER BY created_at DESC LIMIT 1",
    [email.toLowerCase(), purpose]
  );

  if (!record) return { valid: false, error: 'No verification code found. Please request a new one.' };
  if (new Date(record.expires_at) < new Date()) return { valid: false, error: 'Verification code expired. Please request a new one.' };
  if (record.attempts >= MAX_ATTEMPTS) return { valid: false, error: 'Too many incorrect attempts. Please request a new code.' };

  const match = await bcrypt.compare(otp.trim(), record.otp_hash);
  if (!match) {
    await query('UPDATE email_verifications SET attempts = attempts + 1 WHERE id = $1', [record.id]);
    const remaining = MAX_ATTEMPTS - record.attempts - 1;
    return { valid: false, error: `Incorrect code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` };
  }

  await query('UPDATE email_verifications SET verified = true WHERE id = $1', [record.id]);
  return { valid: true };
}

// ── Check login rate limit (by IP + email) ────────────────────────────────────
export async function checkLoginRateLimit(email: string, ip: string): Promise<{ allowed: boolean; lockoutSeconds?: number }> {
  try {
    const rows = await query<{ count: string }>(
      "SELECT COUNT(*) as count FROM login_attempts WHERE identifier=$1 AND success=false AND created_at > NOW() - INTERVAL '15 minutes'",
      [email.toLowerCase()]
    );
    const count = parseInt((rows[0] as any)?.count ?? '0');
    if (count >= 10) return { allowed: false, lockoutSeconds: 900 };
    if (count >= 5)  return { allowed: false, lockoutSeconds: 300 };
    return { allowed: true };
  } catch {
    return { allowed: true }; // fail-open if table doesn't exist yet
  }
}

export async function recordLoginAttempt(email: string, success: boolean, ip: string, ua: string): Promise<void> {
  await query(
    'INSERT INTO login_attempts (identifier, success, ip_address, user_agent) VALUES ($1, $2, $3, $4)',
    [email.toLowerCase(), success, ip, ua]
  ).catch(() => {});
}
