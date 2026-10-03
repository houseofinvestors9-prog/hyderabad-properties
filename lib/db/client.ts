import path from 'node:path';
import { mkdirSync } from 'node:fs';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema';
import { seedIfEmpty } from './seed';

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * Database client.
 *
 * - DATABASE_URL set  -> real PostgreSQL (Neon, Supabase, Cloud SQL, RDS...) via postgres-js
 * - DATABASE_URL unset -> embedded PostgreSQL (PGlite) persisted to ./.data/pglite. Single process only:
 *   do not use it on hosts that run several app processes (Hostinger Web Apps do), use DATABASE_URL there.
 *
 * Both run the same migrations from ./drizzle and seed the original mock projects
 * on first boot, so local dev needs zero setup and production is a single env var.
 */
type Cache = { db?: Promise<DB> };
const g = globalThis as unknown as { __hpDb?: Cache };
g.__hpDb ??= {};

const MIGRATIONS = path.join(process.cwd(), 'drizzle');

async function connect(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import('postgres');
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const { migrate } = await import('drizzle-orm/postgres-js/migrator');
    const sql = postgres(url, { max: Number(process.env.DATABASE_POOL_MAX ?? 5), prepare: false });
    const db = drizzle(sql, { schema });
    // Hosts like Hostinger start several app processes at once. A session-level advisory lock on one
    // reserved connection makes them migrate and seed one at a time.
    const lock = await sql.reserve();
    try {
      await lock`select pg_advisory_lock(727274)`;
      await migrate(db, { migrationsFolder: MIGRATIONS });
      await seedIfEmpty(db as unknown as DB);
    } finally {
      await lock`select pg_advisory_unlock(727274)`.catch(() => {});
      lock.release();
    }
    return db as unknown as DB;
  }

  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  const dataDir = process.env.PGLITE_DIR ?? path.join(process.cwd(), '.data', 'pglite');
  mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  await seedIfEmpty(db as unknown as DB);
  return db as unknown as DB;
}

export function getDb(): Promise<DB> {
  if (!g.__hpDb!.db) {
    g.__hpDb!.db = connect().catch((err) => {
      g.__hpDb!.db = undefined;
      throw err;
    });
  }
  return g.__hpDb!.db;
}

export { schema };
