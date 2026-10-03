import type { MetadataRoute } from 'next';

export const dynamic = 'force-dynamic';

const SITE = (process.env.PUBLIC_SITE_URL ?? process.env.APP_URL ?? 'https://hyderabad.properties').replace(/\/$/, '');
// Keep the temporary Hostinger address out of search results; open up once the real domain is live.
const PUBLIC = /hyderabad\.properties/.test(SITE);

export default function robots(): MetadataRoute.Robots {
  return PUBLIC
    ? { rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] }], sitemap: `${SITE}/sitemap.xml` }
    : { rules: [{ userAgent: '*', disallow: '/' }] };
}
