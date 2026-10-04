import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { and, count, desc, eq, gt, isNull } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { getDb } from './db/client';
import { loginCodes, savedProjects, userSessions, users, type UserRow } from './db/schema';
import { sendWhatsappOtp, whatsappOtpConfigured } from './whatsapp-otp';

/**
 * Optional buyer login with a WhatsApp one-time code.
 *
 * - The phone number is the identity. No passwords.
 * - Codes: 6 digits, valid 10 minutes, 5 tries, only an HMAC of the code is stored.
 * - Limits: 3 codes per number per 15 minutes, 10 per IP per hour.
 * - Session: random 32-byte token in an httpOnly cookie for 90 days; only its SHA-256 is stored.
 *
 * Without Gallabox settings, development prints the code to the server log and returns it to the
 * login form; production refuses to send, so the login stays hidden until WhatsApp is set up.
 */

export const BUYER_COOKIE = 'hp_session';
const SESSION_DAYS = 90;
const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('ADMIN_SESSION_SECRET must be set in production.');
  return 'dev-only-session-secret-change-me';
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const codeHash = (phone: string, code: string) => createHmac('sha256', secret()).update(`${phone}:${code}`).digest('hex');

/** Indian mobile numbers to E.164. Accepts 98765 43210, 098765..., +91 98765..., 91 98765.... Null if not valid. */
export function normalisePhone(input: string): string | null {
  let d = input.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (!/^[6-9]\d{9}$/.test(d)) return null;
  return `+91${d}`;
}

export function loginAvailable(): boolean {
  return whatsappOtpConfigured() || process.env.NODE_ENV !== 'production';
}

export type RequestCodeResult = { ok: true; devCode?: string } | { ok: false; error: string; status: number };

export async function requestLoginCode(rawPhone: string, ip: string | null): Promise<RequestCodeResult> {
  const phone = normalisePhone(rawPhone);
  if (!phone) return { ok: false, error: 'Enter a 10-digit Indian mobile number.', status: 400 };
  if (!loginAvailable()) return { ok: false, error: 'WhatsApp login is not switched on yet.', status: 503 };

  const db = await getDb();
  const since15 = new Date(Date.now() - 15 * 60_000);
  const [{ n: perPhone }] = await db.select({ n: count() }).from(loginCodes).where(and(eq(loginCodes.phone, phone), gt(loginCodes.createdAt, since15)));
  if (perPhone >= 3) return { ok: false, error: 'Too many codes for this number. Try again in 15 minutes.', status: 429 };
  if (ip) {
    const sinceHour = new Date(Date.now() - 60 * 60_000);
    const [{ n: perIp }] = await db.select({ n: count() }).from(loginCodes).where(and(eq(loginCodes.ip, ip), gt(loginCodes.createdAt, sinceHour)));
    if (perIp >= 10) return { ok: false, error: 'Too many attempts. Try again in an hour.', status: 429 };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await db.insert(loginCodes).values({
    phone,
    codeHash: codeHash(phone, code),
    ip,
    expiresAt: new Date(Date.now() + CODE_MINUTES * 60_000),
  });

  if (whatsappOtpConfigured()) {
    try {
      await sendWhatsappOtp(phone, code);
    } catch (err) {
      console.error('[login] WhatsApp code not sent', err);
      return { ok: false, error: 'We could not send the code on WhatsApp. Please try again.', status: 502 };
    }
    return { ok: true };
  }
  console.log(`[login] development code for ${phone}: ${code}`);
  return { ok: true, devCode: code };
}

export type VerifyResult = { ok: true; user: UserRow; isNew: boolean } | { ok: false; error: string; status: number };

export async function verifyLoginCode(rawPhone: string, code: string, userAgent: string | null): Promise<VerifyResult> {
  const phone = normalisePhone(rawPhone);
  if (!phone || !/^\d{6}$/.test(code)) return { ok: false, error: 'Enter the 6-digit code from WhatsApp.', status: 400 };

  const db = await getDb();
  const [row] = await db
    .select()
    .from(loginCodes)
    .where(and(eq(loginCodes.phone, phone), isNull(loginCodes.consumedAt), gt(loginCodes.expiresAt, new Date())))
    .orderBy(desc(loginCodes.createdAt))
    .limit(1);
  if (!row) return { ok: false, error: 'This code has expired. Ask for a new one.', status: 400 };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, error: 'Too many wrong tries. Ask for a new code.', status: 429 };

  const expected = Buffer.from(row.codeHash, 'hex');
  const given = Buffer.from(codeHash(phone, code), 'hex');
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    await db.update(loginCodes).set({ attempts: row.attempts + 1 }).where(eq(loginCodes.id, row.id));
    return { ok: false, error: 'That code is not right. Check WhatsApp and try again.', status: 400 };
  }
  await db.update(loginCodes).set({ consumedAt: new Date() }).where(eq(loginCodes.id, row.id));

  const existing = (await db.select().from(users).where(eq(users.phone, phone)).limit(1))[0];
  let user: UserRow;
  if (existing) {
    [user] = await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, existing.id)).returning();
  } else {
    [user] = await db.insert(users).values({ phone }).onConflictDoNothing().returning();
    user ??= (await db.select().from(users).where(eq(users.phone, phone)).limit(1))[0];
  }

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(userSessions).values({ tokenHash: sha256(token), userId: user.id, userAgent: userAgent?.slice(0, 300) ?? null, expiresAt });
  const jar = await cookies();
  jar.set(BUYER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
  return { ok: true, user, isNew: !existing };
}

/** The logged-in buyer, or null. Safe to call from server components and route handlers. */
export async function currentUser(): Promise<UserRow | null> {
  const token = (await cookies()).get(BUYER_COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const rows = await db
    .select({ user: users })
    .from(userSessions)
    .innerJoin(users, eq(users.id, userSessions.userId))
    .where(and(eq(userSessions.tokenHash, sha256(token)), gt(userSessions.expiresAt, new Date())))
    .limit(1);
  return rows[0]?.user ?? null;
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(BUYER_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(userSessions).where(eq(userSessions.tokenHash, sha256(token)));
  }
  jar.delete(BUYER_COOKIE);
}

export async function updateProfile(userId: string, input: { name?: string; email?: string }) {
  const db = await getDb();
  const [u] = await db
    .update(users)
    .set({ name: input.name?.trim().slice(0, 120) || null, email: input.email?.trim().slice(0, 160) || null })
    .where(eq(users.id, userId))
    .returning();
  return u;
}

export async function listSaved(userId: string) {
  const db = await getDb();
  return db.select().from(savedProjects).where(eq(savedProjects.userId, userId)).orderBy(desc(savedProjects.createdAt));
}

export async function setSaved(userId: string, kind: 'rera' | 'project', ref: string, saved: boolean) {
  const db = await getDb();
  if (saved) await db.insert(savedProjects).values({ userId, kind, ref }).onConflictDoNothing();
  else await db.delete(savedProjects).where(and(eq(savedProjects.userId, userId), eq(savedProjects.kind, kind), eq(savedProjects.ref, ref)));
}
