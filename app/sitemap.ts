import type { MetadataRoute } from 'next';
import { registrySitemapEntries } from '@/lib/data/rera';

export const dynamic = 'force-dynamic';

const SITE = (process.env.PUBLIC_SITE_URL ?? process.env.APP_URL ?? 'https://hyderabad.properties').replace(/\/$/, '');

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const registry = await registrySitemapEntries().catch(() => []);
  return [
    { url: `${SITE}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE}/rera`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE}/rera/orders`, changeFrequency: 'weekly', priority: 0.7 },
    ...registry.map((r) => ({ url: `${SITE}/rera/${r.slug}`, lastModified: r.updated, changeFrequency: 'weekly' as const, priority: 0.6 })),
  ];
}
