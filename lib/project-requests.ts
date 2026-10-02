import { desc, eq, sql } from 'drizzle-orm';
import { getDb } from './db/client';
import { projectRequests, type ProjectRequestStatus } from './db/schema';
import { captureLead } from './leads';

export interface ProjectRequestInput {
  projectName: string;
  area: string;
  developer?: string;
  reraNumber?: string;
  stage?: string;
  searchedQuery?: string;
  requesterName?: string;
  requesterEmail?: string;
  requesterPhone?: string;
}

/** "Aurelia Heights, Phase-2" and "aurelia heights phase 2" count as the same request. */
export function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Record a project a buyer wants checked. The requester is also a lead with a
 * named project in mind, so they go to the CRM the same way as any other lead.
 */
export async function createProjectRequest(input: ProjectRequestInput) {
  const leadId = await captureLead({
    source: 'project_request',
    name: input.requesterName,
    email: input.requesterEmail,
    phone: input.requesterPhone,
    projectName: input.projectName,
    message: [
      `Asked us to check: ${input.projectName}`,
      `Area: ${input.area}`,
      input.developer && `Builder: ${input.developer}`,
      input.reraNumber && `RERA no: ${input.reraNumber}`,
      input.stage && `Stage: ${input.stage}`,
    ]
      .filter(Boolean)
      .join('\n'),
    consent: true,
  });

  const db = await getDb();
  const [row] = await db
    .insert(projectRequests)
    .values({ ...input, nameKey: nameKey(input.projectName), leadId })
    .returning({ id: projectRequests.id });
  return row.id;
}

/** Open requests grouped by project, most asked-for first. Feeds the Review Desk. */
export async function listProjectRequests(limit = 50) {
  const db = await getDb();
  return db
    .select({
      nameKey: projectRequests.nameKey,
      projectName: sql<string>`max(${projectRequests.projectName})`,
      area: sql<string | null>`max(${projectRequests.area})`,
      developer: sql<string | null>`max(${projectRequests.developer})`,
      reraNumber: sql<string | null>`max(${projectRequests.reraNumber})`,
      stage: sql<string | null>`max(${projectRequests.stage})`,
      requests: sql<number>`count(*)::int`,
      lastAskedAt: sql<string>`max(${projectRequests.createdAt})`,
      status: sql<ProjectRequestStatus>`min(${projectRequests.status})`,
    })
    .from(projectRequests)
    .where(sql`${projectRequests.status} in ('new', 'researching')`)
    .groupBy(projectRequests.nameKey)
    .orderBy(desc(sql`count(*)`), desc(sql`max(${projectRequests.createdAt})`))
    .limit(limit);
}

export type ProjectRequestGroup = Awaited<ReturnType<typeof listProjectRequests>>[number];

/** Move every request for one project to a new status (for example once it is added). */
export async function setProjectRequestStatus(key: string, status: ProjectRequestStatus, addedProjectId?: string) {
  const db = await getDb();
  await db
    .update(projectRequests)
    .set({ status, ...(addedProjectId ? { addedProjectId } : {}) })
    .where(eq(projectRequests.nameKey, key));
}
