import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createOTP, verifyOTP, checkRateLimit } from './otp.service.js';
import { dispatchEmail } from '../settings/email.dispatcher.js';

export async function otpRoutes(app: FastifyInstance) {
  // POST /otp/send — send a 6-digit OTP to an email
  app.post('/send', async (req, reply) => {
    const { email, purpose } = z.object({
      email:   z.string().email(),
      purpose: z.enum(['registration', 'password_reset', 'email_change']),
    }).parse(req.body);

    const ip = req.ip;
    const rl = await checkRateLimit(`${ip}:${email}`, 'otp_send', 3, 60_000);
    if (!rl.allowed) {
      return reply.status(429).send({ error: `Too many requests. Please wait ${rl.retryAfter} seconds.` });
    }

    const otp = await createOTP(email, purpose);

    const subjectMap: Record<string, string> = {
      registration:   'Your Hola Prime verification code',
      password_reset: 'Reset your Hola Prime password',
      email_change:   'Confirm your new email address',
    };

    const bodyMap: Record<string, string> = {
      registration:   `Your verification code is <strong style="font-size:28px;letter-spacing:4px;color:#4F8CF7">${otp}</strong><br><br>This code expires in 10 minutes. Do not share it with anyone.`,
      password_reset: `Your password reset code is <strong style="font-size:28px;letter-spacing:4px;color:#4F8CF7">${otp}</strong><br><br>This code expires in 10 minutes. If you didn't request this, ignore this email.`,
      email_change:   `Your email change verification code is <strong style="font-size:28px;letter-spacing:4px;color:#4F8CF7">${otp}</strong><br><br>This code expires in 10 minutes.`,
    };

    await dispatchEmail({
      to:      email,
      subject: subjectMap[purpose],
      html:    `
        <div style="font-family:'Helvetica Neue',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0B1120;color:#F1F5F9;border-radius:12px;">
          <img src="https://holaprime.com/logo-white.png" alt="Hola Prime" style="height:40px;margin-bottom:28px;"/>
          <h2 style="font-size:22px;font-weight:700;margin-bottom:12px;">Verification Code</h2>
          <p style="color:#94A3B8;margin-bottom:24px;">${bodyMap[purpose]}</p>
          <p style="font-size:12px;color:#64748B;">Hola Prime · FSC Licensed GB24203729</p>
        </div>`,
    }).catch(() => {}); // Don't fail if email is misconfigured during setup

    // In dev mode: return the OTP in the response for testing
    const isDev = process.env.NODE_ENV !== 'production';
    return reply.send({ ok: true, ...(isDev ? { _dev_otp: otp } : {}) });
  });

  // POST /otp/verify — verify the OTP code
  app.post('/verify', async (req, reply) => {
    const { email, otp, purpose } = z.object({
      email:   z.string().email(),
      otp:     z.string().length(6),
      purpose: z.enum(['registration', 'password_reset', 'email_change']),
    }).parse(req.body);

    const ip = req.ip;
    const rl = await checkRateLimit(`${ip}:${email}`, 'otp_verify', 10, 60_000);
    if (!rl.allowed) return reply.status(429).send({ error: 'Too many verification attempts. Please wait a minute.' });

    const result = await verifyOTP(email, otp, purpose);
    if (!result.valid) return reply.status(400).send({ error: result.error });
    return reply.send({ ok: true, verified: true });
  });
}
