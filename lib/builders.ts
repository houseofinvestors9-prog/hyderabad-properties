/**
 * Builders with a page at /builders/[slug].
 *
 * A project is listed under a builder only when the TG-RERA record itself says so: the registered
 * promoter is one of the companies named here, or the registered project name carries the brand.
 * We do not attach projects through group structures or special-purpose companies we know about
 * but the record does not show; that would be our inference, not the filing.
 *
 * `markets` lists registrations House of Investors (owner of this site) is paid to market. Those
 * pages carry a disclosure; the facts shown are the same record every project gets.
 */
export interface Builder {
  slug: string;
  name: string;
  /** Lower-case words that must appear in the promoter or project name, to narrow the database query. */
  keywords: string[];
  /** Registered promoter names that belong to this builder. */
  promoter: RegExp;
  /** Registered project names that carry the brand, whoever the promoter is. */
  projectName?: RegExp;
  /** Registrations that match the patterns but are another company's. */
  exclude?: string[];
  markets?: string[];
}

export const BUILDERS: Builder[] = [
  {
    slug: 'prestige',
    name: 'Prestige Group',
    keywords: ['prestige'],
    promoter: /^prestige\b/i,
    projectName: /^(the )?prestige\b/i,
    markets: ['REA02400049700'], // Prestige Clairemont
  },
  { slug: 'my-home', name: 'My Home Group', keywords: ['my home'], promoter: /^my home constructions\b/i, projectName: /^my home\b/i },
  { slug: 'aparna', name: 'Aparna Constructions', keywords: ['aparna'], promoter: /^aparna (constructions|infrahousing)\b/i, projectName: /^aparna\b/i },
  { slug: 'rajapushpa', name: 'Rajapushpa Properties', keywords: ['rajapushpa'], promoter: /^rajapushpa\b/i, projectName: /^rajapushpa\b/i },
  { slug: 'godrej', name: 'Godrej Properties', keywords: ['godrej'], promoter: /^godrej properties\b/i, projectName: /^godrej\b/i },
  { slug: 'asbl', name: 'ASBL', keywords: ['asbl', 'ashoka builders'], promoter: /^ashoka builders india\b/i, projectName: /^asbl/i },
  { slug: 'myscape', name: 'Myscape Properties', keywords: ['myscape'], promoter: /^myscape properties\b/i, projectName: /\bmyscape\b/i },
  { slug: 'ramky', name: 'Ramky Estates', keywords: ['ramky'], promoter: /^ramky\b/i, projectName: /^ramky\b/i },
  { slug: 'cybercity', name: 'Cybercity Builders', keywords: ['cybercity'], promoter: /^cybercity (blue edge|phase\s?\d|hallmark)\b/i, projectName: /\bby cybercity\b|^cybercity\b/i },
  { slug: 'vertex', name: 'Vertex Homes', keywords: ['vertex'], promoter: /^vertex (homes|vega|viva)\b/i, projectName: /^vertex\b/i },
  {
    slug: 'sri-aditya-homes',
    name: 'Sri Aditya Homes',
    keywords: ['sri aditya homes'],
    promoter: /^sri aditya homes\b/i,
    markets: ['REA02400107806'], // Sri Aditya Terrace 35
  },
];

export function builderBySlug(slug: string): Builder | undefined {
  return BUILDERS.find((b) => b.slug === slug);
}

export function builderMatches(b: Builder, r: { promoter: string | null; name: string; registrationNo: string }): boolean {
  if (b.exclude?.includes(r.registrationNo)) return false;
  return (!!r.promoter && b.promoter.test(r.promoter.trim())) || (!!b.projectName && b.projectName.test(r.name.trim()));
}

export function builderFor(r: { promoter: string | null; name: string; registrationNo: string }): Builder | undefined {
  return BUILDERS.find((b) => builderMatches(b, r));
}

/** Registrations House of Investors markets, for the disclosure line. */
export function marketedByOwner(registrationNo: string): boolean {
  return BUILDERS.some((b) => b.markets?.includes(registrationNo));
}
