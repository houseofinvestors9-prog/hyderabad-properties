export interface MicroMarket {
  name: string;
  minRate: number;
  maxRate: number;
  description: string;
}

export interface ProjectSafetyItem {
  id: string;
  name: string;
  location: string;
  microMarket: string;
  reraNumber: string;
  lastVerifiedDate: string;
  reraStatus: 'Active' | 'Pending' | 'Not Found';
  buildingPlan: 'Approved' | 'Pending';
  lakeBuffer: 'Clear' | 'Inside buffer zone';
  priceRange: string;
  ratePerSqFt: number;
  config: string;
  possessionYear: string;
  distanceToIT: string;
  status: 'safe' | 'warning' | 'risk';
  statusLabel: 'Looks Safe' | 'Needs a Closer Look' | 'High Risk';
  score: number;
  summary: string;
  whySummary: string;
  keyConcerns?: string[];

  // Live statutory fields (populated from the database once records are pushed live)
  developer?: string | null;
  reraValidUntil?: string | null;
  escrowAccount?: string | null;
  lastQprFiled?: string | null;
  permitNo?: string | null;
  sanctionedFloors?: number | null;
  sanctionedConfig?: string | null;
  ocStatus?: string | null;
  surveyNumbers?: string | null;
  nearestLakeMeters?: number | null;
  siteLat?: number | null;
  siteLng?: number | null;
  questions?: string[];
  sources?: { label: string; url: string }[];
  signedOffBy?: string | null;
  signedOffAt?: string | null;
  /** House of Investors, which owns the site, is paid to market this project. */
  marketedByOwner?: boolean;
  lastVerifiedAt?: string; // ISO timestamp
  updatedAt?: string; // ISO timestamp
  version?: number;
}

export interface MicroMarketLive extends MicroMarket {
  guidelineRatePerSqFt?: number | null;
  guidelineUpdatedAt?: string | null;
}

export interface ProjectAlertItem {
  id: string;
  projectId: string;
  projectName: string;
  date: string;
  type: string;
  whatChanged: string;
  whatItMeans: string;
  source?: string | null;
  sourceUrl?: string | null;
  publishedAt: string;
}

export interface LiveSnapshot {
  projects: ProjectSafetyItem[];
  markets: MicroMarketLive[];
  alerts: ProjectAlertItem[];
  version: string;
  generatedAt: string;
}

export const MICRO_MARKETS: MicroMarket[] = [
  { name: 'Neopolis', minRate: 14000, maxRate: 17500, description: 'High-density commercial and residential corridor off the Outer Ring Road.' },
  { name: 'Kokapet', minRate: 11000, maxRate: 14000, description: 'Western IT corridor expansion hub connecting to the airport expressway.' },
  { name: 'Financial District', minRate: 10500, maxRate: 17500, description: 'Core tech tower district with walk-to-work developments.' },
  { name: 'Narsingi / Tellapur', minRate: 8600, maxRate: 10500, description: 'Residential belt near Outer Ring Road junctions.' },
  { name: 'Somajiguda', minRate: 9000, maxRate: 16000, description: 'Central city business district with older residential layouts.' },
  { name: 'LB Nagar / Uppal', minRate: 6600, maxRate: 7550, description: 'Eastern transit corridor connected to the metro network.' },
];

export const MOCK_PROJECTS: ProjectSafetyItem[] = [
  {
    id: 'aurelia-heights',
    name: 'Aurelia Heights',
    location: 'Neopolis',
    microMarket: 'Neopolis',
    reraNumber: 'P02400005821',
    lastVerifiedDate: 'Yesterday at 4:15 PM',
    reraStatus: 'Active',
    buildingPlan: 'Approved',
    lakeBuffer: 'Clear',
    priceRange: '₹2.40 Cr – ₹3.85 Cr',
    ratePerSqFt: 15400,
    config: '3 & 4 BHK',
    possessionYear: '2027',
    distanceToIT: '10 mins to Financial District',
    status: 'safe',
    statusLabel: 'Looks Safe',
    score: 94,
    summary: 'Clear government land titles with full building plan sanction and an active RERA registration. The site sits outside all lake and waterbody buffer zones.',
    whySummary: 'Land ownership records are digitized with no active civil suits. Municipal approvals and environmental clearances are verified on state portals.',
  },
  {
    id: 'lakeview-residency',
    name: 'Lakeview Residency',
    location: 'Narsingi',
    microMarket: 'Narsingi / Tellapur',
    reraNumber: 'P02400003419',
    lastVerifiedDate: 'Today at 9:30 AM',
    reraStatus: 'Pending',
    buildingPlan: 'Pending',
    lakeBuffer: 'Inside buffer zone',
    priceRange: '₹1.15 Cr – ₹1.65 Cr',
    ratePerSqFt: 8900,
    config: '2 & 3 BHK',
    possessionYear: '2026',
    distanceToIT: '15 mins to Gachibowli',
    status: 'risk',
    statusLabel: 'High Risk',
    score: 42,
    summary: 'Parts of the project plot overlap with the Full Tank Level (FTL) lake protection zone. HYDRAA has flagged buffer violations in this revenue survey number.',
    whySummary: 'The project boundary encroaches into the 30-meter lake buffer boundary. Buying property inside waterbody buffer zones carries severe demolition and non-registration risks.',
    keyConcerns: [
      'Plot touches Full Tank Level (FTL) boundary line',
      'No final municipal building sanction in place',
      'High scrutiny area under recent HYDRAA enforcement',
    ],
  },
  {
    id: 'skyline-crest',
    name: 'Skyline Crest',
    location: 'Financial District',
    microMarket: 'Financial District',
    reraNumber: 'P02400004910',
    lastVerifiedDate: '2 days ago',
    reraStatus: 'Active',
    buildingPlan: 'Approved',
    lakeBuffer: 'Clear',
    priceRange: '₹2.10 Cr – ₹3.20 Cr',
    ratePerSqFt: 14500,
    config: '3 & 4 BHK',
    possessionYear: '2026',
    distanceToIT: '5 mins to Waverock IT Park',
    status: 'safe',
    statusLabel: 'Looks Safe',
    score: 91,
    summary: 'All town planning sanctions are confirmed with verified 30-year link titles. No waterbody or eco-sensitive zone conflicts exist on any corner of the master layout.',
    whySummary: 'Sanctioned municipal layout with clear link documents, zero revenue department encumbrances, and verified RERA quarterly disclosures.',
  },
  {
    id: 'banyan-park',
    name: 'Banyan Park',
    location: 'Kokapet',
    microMarket: 'Kokapet',
    reraNumber: 'P02400006124',
    lastVerifiedDate: '3 days ago',
    reraStatus: 'Active',
    buildingPlan: 'Pending',
    lakeBuffer: 'Clear',
    priceRange: '₹1.55 Cr – ₹2.45 Cr',
    ratePerSqFt: 12800,
    config: '2, 3 & 4 BHK',
    possessionYear: '2028',
    distanceToIT: '12 mins to Financial District',
    status: 'warning',
    statusLabel: 'Needs a Closer Look',
    score: 73,
    summary: 'RERA registration is active, but the revised master building plan amendment is currently pending municipal sanction. The lake buffer check is clear.',
    whySummary: 'The builder applied for an additional floor sanction that has not yet received final municipal sign-off. Verify which floors are sanctioned before committing.',
    keyConcerns: [
      'Top 4 floors awaiting revised municipal permission',
      'Lake buffer is clear, but check your exact tower number',
    ],
  },
  {
    id: 'marina-greens',
    name: 'Marina Greens',
    location: 'Tellapur',
    microMarket: 'Narsingi / Tellapur',
    reraNumber: 'P02400005187',
    lastVerifiedDate: 'This week',
    reraStatus: 'Pending',
    buildingPlan: 'Approved',
    lakeBuffer: 'Clear',
    priceRange: '₹1.05 Cr – ₹1.70 Cr',
    ratePerSqFt: 9200,
    config: '2 & 3 BHK',
    possessionYear: '2027',
    distanceToIT: '18 mins to Gachibowli',
    status: 'warning',
    statusLabel: 'Needs a Closer Look',
    score: 68,
    summary: 'Building plan is approved, but the RERA extension certificate is still being processed. The site layout borders an official drainage canal buffer line.',
    whySummary: 'The building itself sits outside the channel, but the irrigation map was recently redrawn. An independent survey verification is recommended before token advance.',
    keyConcerns: [
      'RERA renewal application in progress with authorities',
      'Adjacent to 9-meter stormwater channel buffer line',
    ],
  },
  {
    id: 'orchid-terraces',
    name: 'Orchid Terraces',
    location: 'Uppal',
    microMarket: 'LB Nagar / Uppal',
    reraNumber: 'P02400004289',
    lastVerifiedDate: 'Last week',
    reraStatus: 'Active',
    buildingPlan: 'Approved',
    lakeBuffer: 'Clear',
    priceRange: '₹78 Lakhs – ₹1.25 Cr',
    ratePerSqFt: 7100,
    config: '2 & 3 BHK',
    possessionYear: '2026',
    distanceToIT: '10 mins to Pocharam IT Corridor',
    status: 'safe',
    statusLabel: 'Looks Safe',
    score: 88,
    summary: 'Clean municipal title with all approvals in hand. Completely free from irrigation canals and waterbody conservation zones with direct metro access.',
    whySummary: 'Verified 35-year encumbrance search certificate, clear municipal building permission, and transparent undivided land share allocation.',
  },
];

export const JARGON_DICTIONARY: Record<string, { term: string; explanation: string }> = {
  RERA: {
    term: 'RERA',
    explanation: 'Real Estate Regulatory Authority — the government body ensuring builders register projects and deliver on time.',
  },
  FTL: {
    term: 'FTL',
    explanation: 'Full Tank Level — the maximum water spread of a lake. Building inside this zone is illegal and subject to demolition.',
  },
  HYDRAA: {
    term: 'HYDRAA',
    explanation: 'Hyderabad Disaster Response and Assets Monitoring Agency — the state task force removing illegal structures on lake beds and government lands.',
  },
  UDS: {
    term: 'UDS',
    explanation: 'Undivided Share of Land — your actual legal ownership share of the plot on which the entire building stands.',
  },
  HMDA: {
    term: 'HMDA',
    explanation: 'Hyderabad Metropolitan Development Authority — the master planning authority that approves layout permissions in outer Hyderabad.',
  },
  GHMC: {
    term: 'GHMC',
    explanation: 'Greater Hyderabad Municipal Corporation — the local municipal body sanctioning construction plans within city limits.',
  },
};

export const FOOTER_DISCLAIMER = 'Informational only. Verify with a qualified professional.';

export type WorkLocation = 
  | 'Hitec City' 
  | 'Financial District' 
  | 'Gachibowli' 
  | 'Madhapur' 
  | 'Kokapet' 
  | 'Somajiguda' 
  | 'Other';

export const WORK_LOCATIONS: WorkLocation[] = [
  'Hitec City',
  'Financial District',
  'Gachibowli',
  'Madhapur',
  'Kokapet',
  'Somajiguda',
  'Other',
];

export interface CommuteEstimate {
  rushMinutes: number;
  offPeakMinutes: number;
}

export type CommuteMatrix = Record<string, Record<WorkLocation, CommuteEstimate>>;

export const MOCK_COMMUTE_MATRIX: CommuteMatrix = {
  'aurelia-heights': {
    'Hitec City': { rushMinutes: 28, offPeakMinutes: 18 },
    'Financial District': { rushMinutes: 14, offPeakMinutes: 8 },
    'Gachibowli': { rushMinutes: 19, offPeakMinutes: 12 },
    'Madhapur': { rushMinutes: 31, offPeakMinutes: 21 },
    'Kokapet': { rushMinutes: 9, offPeakMinutes: 6 },
    'Somajiguda': { rushMinutes: 54, offPeakMinutes: 36 },
    'Other': { rushMinutes: 35, offPeakMinutes: 24 },
  },
  'lakeview-residency': {
    'Hitec City': { rushMinutes: 34, offPeakMinutes: 22 },
    'Financial District': { rushMinutes: 18, offPeakMinutes: 11 },
    'Gachibowli': { rushMinutes: 21, offPeakMinutes: 13 },
    'Madhapur': { rushMinutes: 38, offPeakMinutes: 24 },
    'Kokapet': { rushMinutes: 12, offPeakMinutes: 7 },
    'Somajiguda': { rushMinutes: 48, offPeakMinutes: 32 },
    'Other': { rushMinutes: 38, offPeakMinutes: 25 },
  },
  'skyline-crest': {
    'Hitec City': { rushMinutes: 22, offPeakMinutes: 14 },
    'Financial District': { rushMinutes: 6, offPeakMinutes: 4 },
    'Gachibowli': { rushMinutes: 11, offPeakMinutes: 7 },
    'Madhapur': { rushMinutes: 26, offPeakMinutes: 16 },
    'Kokapet': { rushMinutes: 13, offPeakMinutes: 8 },
    'Somajiguda': { rushMinutes: 49, offPeakMinutes: 33 },
    'Other': { rushMinutes: 32, offPeakMinutes: 20 },
  },
  'banyan-park': {
    'Hitec City': { rushMinutes: 29, offPeakMinutes: 19 },
    'Financial District': { rushMinutes: 13, offPeakMinutes: 8 },
    'Gachibowli': { rushMinutes: 17, offPeakMinutes: 10 },
    'Madhapur': { rushMinutes: 32, offPeakMinutes: 22 },
    'Kokapet': { rushMinutes: 4, offPeakMinutes: 3 },
    'Somajiguda': { rushMinutes: 52, offPeakMinutes: 35 },
    'Other': { rushMinutes: 36, offPeakMinutes: 23 },
  },
  'marina-greens': {
    'Hitec City': { rushMinutes: 26, offPeakMinutes: 17 },
    'Financial District': { rushMinutes: 44, offPeakMinutes: 28 },
    'Gachibowli': { rushMinutes: 36, offPeakMinutes: 24 },
    'Madhapur': { rushMinutes: 23, offPeakMinutes: 15 },
    'Kokapet': { rushMinutes: 47, offPeakMinutes: 31 },
    'Somajiguda': { rushMinutes: 39, offPeakMinutes: 26 },
    'Other': { rushMinutes: 41, offPeakMinutes: 27 },
  },
  'orchid-terraces': {
    'Hitec City': { rushMinutes: 68, offPeakMinutes: 46 },
    'Financial District': { rushMinutes: 74, offPeakMinutes: 51 },
    'Gachibowli': { rushMinutes: 71, offPeakMinutes: 49 },
    'Madhapur': { rushMinutes: 66, offPeakMinutes: 44 },
    'Kokapet': { rushMinutes: 79, offPeakMinutes: 54 },
    'Somajiguda': { rushMinutes: 33, offPeakMinutes: 21 },
    'Other': { rushMinutes: 50, offPeakMinutes: 34 },
  },
};
