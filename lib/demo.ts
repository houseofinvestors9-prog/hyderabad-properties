/**
 * Demo data: the six made-up sample projects, the pre-watched project and the
 * "Simulate a change" controls. On in development, off in production unless
 * NEXT_PUBLIC_DEMO_DATA=true is set on purpose (for a staging site).
 *
 * The sample projects use invented names, builders and RERA numbers. They must
 * never appear on the public site, where a reader could take them as real checks.
 */
export const DEMO_DATA =
  process.env.NEXT_PUBLIC_DEMO_DATA === 'true' ||
  (process.env.NEXT_PUBLIC_DEMO_DATA !== 'false' && process.env.NODE_ENV !== 'production');
