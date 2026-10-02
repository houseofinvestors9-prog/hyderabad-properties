import { NextResponse } from 'next/server';
import { z } from 'zod';
import { listProjectRequests, setProjectRequestStatus } from '@/lib/project-requests';
import { badRequest } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

/** GET /api/admin/project-requests: open requests grouped by project. Guarded by middleware. */
export async function GET() {
  return NextResponse.json({ requests: await listProjectRequests() });
}

const Patch = z.object({
  nameKey: z.string().min(1).max(200),
  status: z.enum(['new', 'researching', 'added', 'rejected']),
  addedProjectId: z.string().max(120).optional(),
});

/** PATCH /api/admin/project-requests: move a requested project along (researching, added, rejected). */
export async function PATCH(req: Request) {
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest('Invalid request', parsed.error.flatten());
  await setProjectRequestStatus(parsed.data.nameKey, parsed.data.status, parsed.data.addedProjectId);
  return NextResponse.json({ ok: true });
}
