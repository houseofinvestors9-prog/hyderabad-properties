/**
 * Representative photography for project cards and reports.
 *
 * These are stock photos (see public/img/CREDITS.md), not pictures of the named projects.
 * Every place that shows one also shows the "Representative photo" label. Replace with
 * real renders per project once they are verified.
 */
const PROJECT_IMAGES: Record<string, string> = {
  'aurelia-heights': '/img/p1.jpg',
  'lakeview-residency': '/img/p2.jpg',
  'skyline-crest': '/img/p3.jpg',
  'banyan-park': '/img/p4.jpg',
  'marina-greens': '/img/p5.jpg',
  'orchid-terraces': '/img/p6.jpg',
};

const FALLBACKS = ['/img/p1.jpg', '/img/p2.jpg', '/img/p3.jpg', '/img/p4.jpg', '/img/p5.jpg', '/img/p6.jpg'];

export function projectImage(id: string): string {
  if (PROJECT_IMAGES[id]) return PROJECT_IMAGES[id];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return FALLBACKS[hash % FALLBACKS.length];
}

export const AREA_IMAGES: Record<string, string> = {
  Neopolis: '/img/area3.jpg',
  'Financial District': '/img/area1.jpg',
  Kokapet: '/img/area2.jpg',
};

export const REPRESENTATIVE_PHOTO_LABEL = 'Representative photo';
