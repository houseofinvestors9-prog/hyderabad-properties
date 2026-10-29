import { NextResponse } from 'next/server';
import { z } from 'zod';
import { addWatch, removeWatch } from '@/lib/data/repo';
import { badRequest } from '@/lib/server-auth';
import { clientIp, rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const Body = z.object({
  projectId: z.string().min(1).max(120),
  channel: z.enum(['whatsapp', 'email']),
  contact: z.string().trim().min(5).max(160),
});

function validContact(channel: 'whatsapp' | 'email', contact: string) {
  return channel === 'email' ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) : /^\+?[\d\s-]{8,18}$/.test(contact);
}

/** POST /api/watch: subscribe a buyer to alerts for a project. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Invalid watch request', parsed.error.flatten());
  const { projectId, channel, contact } = parsed.data;
  if (!validContact(channel, contact)) return badRequest('Enter a valid phone number or email.');
  const limited = await rateLimit('watch', [{ key: clientIp(req), max: 20, windowMinutes: 60 }]);
  if (limited) return limited;
  try {
    const row = await addWatch(projectId, channel, contact);
    return NextResponse.json({ ok: true, id: row.id });
  } catch {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
}

/** DELETE /api/watch: stop alerts. */
export async function DELETE(req: Request) {
  const parsed = Body.pick({ projectId: true, contact: true }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Invalid request');
  await removeWatch(parsed.data.projectId, parsed.data.contact);
  return NextResponse.json({ ok: true });
}
