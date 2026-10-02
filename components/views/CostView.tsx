'use client';

import React, { useState, useMemo } from 'react';
import { 
  HelpCircle, 
  ChevronDown, 
  ArrowLeft, 
  Building2, 
  Receipt, 
  Percent, 
  Clock, 
  Settings2, 
  RotateCcw,
  Check,
  X,
  PhoneCall,
  Info
} from 'lucide-react';
import { ViewType } from '@/components/TopBar';
import { ProjectSafetyItem } from '@/lib/mock-data';

// ============================================================
// RATES SETTINGS
// CONFIRM WITH HOI BEFORE LAUNCH
// All rates are in percentage and can be customized by HoI staff
// ============================================================
export interface CostSettings {
  stampDutyPct: number; // 4.0% in Telangana
  transferDutyPct: number; // 1.5% in Telangana
  registrationPct: number; // 0.5% in Telangana
  gstUnderConstructionPct: number; // 5.0% for non-affordable / 1.0% for affordable
  ratesUpdatedOn: string;
}

export const DEFAULT_COST_SETTINGS: CostSettings = {
  stampDutyPct: 4.0,
  transferDutyPct: 1.5,
  registrationPct: 0.5,
  gstUnderConstructionPct: 5.0,
  ratesUpdatedOn: 'October 2026',
};

// Pure calculation function with no hidden constants
export interface CostBreakdownResult {
  basePrice: number;
  stampDuty: number;
  transferDuty: number;
  registrationFee: number;
  gst: number;
  otherCosts: number;
  totalExtraAboveBase: number;
  totalAcquisitionCost: number;
  // Loan details
  isLoanSkipped: boolean;
  downPaymentAmount: number;
  loanPrincipal: number;
  monthlyEmi: number;
  totalLoanInterest: number;
  totalCostWithInterest: number;
}

export function calculateActualCost(
  basePrice: number,
  propertyType: 'ready' | 'under_construction',
  downPaymentPct: number,
  isLoanSkipped: boolean,
  interestRatePct: number,
  loanTenureYears: number,
  parkingCost: number,
  maintenanceDeposit: number,
  clubhouseFee: number,
  settings: CostSettings
): CostBreakdownResult {
  if (basePrice <= 0) {
    return {
      basePrice: 0,
      stampDuty: 0,
      transferDuty: 0,
      registrationFee: 0,
      gst: 0,
      otherCosts: 0,
      totalExtraAboveBase: 0,
      totalAcquisitionCost: 0,
      isLoanSkipped,
      downPaymentAmount: 0,
      loanPrincipal: 0,
      monthlyEmi: 0,
      totalLoanInterest: 0,
      totalCostWithInterest: 0,
    };
  }

  // Statutory Duties (Telangana Registration & Stamps)
  const stampDuty = Math.round((basePrice * settings.stampDutyPct) / 100);
  const transferDuty = Math.round((basePrice * settings.transferDutyPct) / 100);
  const registrationFee = Math.round((basePrice * settings.registrationPct) / 100);

  // GST: 0% on ready-to-move with Occupancy Certificate, 5% on under-construction
  const gst = propertyType === 'under_construction'
    ? Math.round((basePrice * settings.gstUnderConstructionPct) / 100)
    : 0;

  // Other ancillary costs
  const otherCosts = Math.max(0, parkingCost) + Math.max(0, maintenanceDeposit) + Math.max(0, clubhouseFee);

  // Total extra charges paid directly to government & builder
  const totalExtraAboveBase = stampDuty + transferDuty + registrationFee + gst + otherCosts;
  const totalAcquisitionCost = basePrice + totalExtraAboveBase;

  // Loan calculation
  let downPaymentAmount = 0;
  let loanPrincipal = 0;
  let monthlyEmi = 0;
  let totalLoanInterest = 0;
  let totalCostWithInterest = totalAcquisitionCost;

  if (!isLoanSkipped) {
    downPaymentAmount = Math.round((basePrice * downPaymentPct) / 100);
    loanPrincipal = Math.max(0, basePrice - downPaymentAmount);

    if (loanPrincipal > 0 && interestRatePct > 0 && loanTenureYears > 0) {
      const monthlyRate = interestRatePct / (12 * 100);
      const totalMonths = loanTenureYears * 12;
      const emiFactor = Math.pow(1 + monthlyRate, totalMonths);
      monthlyEmi = Math.round((loanPrincipal * monthlyRate * emiFactor) / (emiFactor - 1));
      const totalRepaid = monthlyEmi * totalMonths;
      totalLoanInterest = Math.max(0, totalRepaid - loanPrincipal);
      totalCostWithInterest = totalAcquisitionCost + totalLoanInterest;
    }
  }

  return {
    basePrice,
    stampDuty,
    transferDuty,
    registrationFee,
    gst,
    otherCosts,
    totalExtraAboveBase,
    totalAcquisitionCost,
    isLoanSkipped,
    downPaymentAmount,
    loanPrincipal,
    monthlyEmi,
    totalLoanInterest,
    totalCostWithInterest,
  };
}

// Indian Currency Formatter with Lakh/Crore Friendly Display
export function formatIndianCurrency(amount: number): string {
  if (isNaN(amount) || amount === 0) return '₹0';
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

export function formatFriendlyLakhCrore(amount: number): string {
  if (!amount || isNaN(amount) || amount <= 0) return '';
  if (amount >= 10000000) {
    const cr = amount / 10000000;
    return `(₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(2)} Cr)`;
  }
  if (amount >= 100000) {
    const lk = amount / 100000;
    return `(₹${lk % 1 === 0 ? lk.toFixed(0) : lk.toFixed(2)} Lakhs)`;
  }
  return `(₹${amount.toLocaleString('en-IN')})`;
}

// Round to nearest 1,000 without fake precision
export function roundToThousand(amount: number): number {
  return Math.round(amount / 1000) * 1000;
}

interface CostViewProps {
  onNavigate: (view: ViewType) => void;
  selectedProject?: ProjectSafetyItem;
  initialPrice?: number;
}

export function CostView({ onNavigate, selectedProject, initialPrice }: CostViewProps) {
  // Determine initial starting price
  const defaultInitialPrice = initialPrice || (selectedProject ? 15000000 : 12000000);

  // 1. Inputs (4 core fields)
  const [propertyPrice, setPropertyPrice] = useState<number>(defaultInitialPrice);
  const [propertyType, setPropertyType] = useState<'ready' | 'under_construction'>('under_construction');
  const [downPaymentPct, setDownPaymentPct] = useState<number>(20);
  const [interestRatePct, setInterestRatePct] = useState<number>(8.75);
  const [loanTenureYears, setLoanTenureYears] = useState<number>(20);
  const [isLoanSkipped, setIsLoanSkipped] = useState<boolean>(false);

  // Other optional ancillary costs
  const [parkingCost, setParkingCost] = useState<number>(300000); // 3 Lakhs standard
  const [maintenanceDeposit, setMaintenanceDeposit] = useState<number>(150000); // 1.5 Lakhs
  const [clubhouseFee, setClubhouseFee] = useState<number>(200000); // 2 Lakhs
  const [isOtherCostsOpen, setIsOtherCostsOpen] = useState<boolean>(false);

  // Settings & Staff editor
  const [settings, setSettings] = useState<CostSettings>(DEFAULT_COST_SETTINGS);
  const [isStaffEditorOpen, setIsStaffEditorOpen] = useState<boolean>(false);

  // Collapsible states
  const [isNriExpanded, setIsNriExpanded] = useState<boolean>(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Calculate results
  const result = useMemo(() => {
    return calculateActualCost(
      propertyPrice,
      propertyType,
      downPaymentPct,
      isLoanSkipped,
      interestRatePct,
      loanTenureYears,
      parkingCost,
      maintenanceDeposit,
      clubhouseFee,
      settings
    );
  }, [
    propertyPrice,
    propertyType,
    downPaymentPct,
    isLoanSkipped,
    interestRatePct,
    loanTenureYears,
    parkingCost,
    maintenanceDeposit,
    clubhouseFee,
    settings,
  ]);

  const toggleTooltip = (key: string) => {
    setActiveTooltip(activeTooltip === key ? null : key);
  };

  // Stacked Bar Percentages
  const totalBarBase = result.totalAcquisitionCost > 0 ? result.totalAcquisitionCost : 1;
  const basePct = Math.round((result.basePrice / totalBarBase) * 100);
  const stampRegPct = Math.round(((result.stampDuty + result.transferDuty + result.registrationFee) / totalBarBase) * 100);
  const gstPct = Math.round((result.gst / totalBarBase) * 100);
  const otherPct = Math.max(0, 100 - basePct - stampRegPct - gstPct);

  return (
    <div className="max-w-[720px] mx-auto px-4 py-4 sm:py-8 space-y-8 animate-in fade-in duration-200 text-left">
      {/* Back button */}
      <div>
        <button
          type="button"
          onClick={() => onNavigate(selectedProject ? 'project' : 'home')}
          className="text-xs font-semibold text-[#6b6b6b] hover:text-[#212121] inline-flex items-center gap-1.5 py-1 min-h-[44px] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          <span>{selectedProject ? `Back to ${selectedProject.name}` : 'Back to Home'}</span>
        </button>
      </div>

      {/* Header */}
      <div className="space-y-1">
        <span className="text-xs uppercase font-bold tracking-wider text-[#212121]">
          Real Estate True Cost Audit
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[#212121]">
          What you&apos;ll actually pay
        </h1>
        <p className="text-xs sm:text-sm text-[#6b6b6b] leading-relaxed">
          In Hyderabad, the builder&apos;s quoted price is never your final cheque. See taxes, registration, and total loan costs upfront.
        </p>

        {selectedProject && (
          <div className="pt-2 text-xs text-[#6b6b6b] flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-[#212121]" strokeWidth={1.5} />
            <span>Prefilled with benchmark price for <strong>{selectedProject.name}</strong> ({selectedProject.location}).</span>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 1. INPUTS (TOP, 4 FIELDS ONLY WITH "?" TOOLTIP) */}
      {/* ============================================================ */}
      <div className="bg-white rounded-xl border border-[#eeeeee] p-5 sm:p-7 space-y-6">
        <h2 className="font-medium text-lg text-[#212121] border-b border-[#f2f2f2] pb-2">
          1. Property & Loan Inputs
        </h2>

        {/* FIELD 1: Property price with Lakh/Crore display */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <label htmlFor="propertyPriceInput" className="text-xs font-semibold text-[#212121]">
                Listed property base price (₹)
              </label>
              <button
                type="button"
                onClick={() => toggleTooltip('price')}
                className="text-[#a3a3a3] hover:text-[#4a4a4a] p-0.5 cursor-pointer"
                aria-label="Explain listed price"
              >
                <HelpCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>
            <span className="text-xs font-bold text-[#212121]">
              {formatFriendlyLakhCrore(propertyPrice)}
            </span>
          </div>

          {activeTooltip === 'price' && (
            <p className="text-[11px] text-[#6b6b6b] bg-[#f9f9f9] p-2.5 rounded-lg border border-[#eeeeee] leading-normal animate-in fade-in duration-100">
              The basic sale price (BSP) quoted by the builder per square foot multiplied by the super built-up area.
            </p>
          )}

          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a3a3a3] font-semibold text-sm">
              ₹
            </span>
            <input
              id="propertyPriceInput"
              type="number"
              min={0}
              step={50000}
              value={propertyPrice || ''}
              onChange={(e) => setPropertyPrice(Math.max(0, Number(e.target.value)))}
              placeholder="e.g. 12000000"
              className="w-full pl-8 pr-4 py-3 rounded-xl border border-[#eeeeee] bg-white text-sm font-semibold text-[#212121] focus:outline-none focus:border-[#212121] min-h-[44px]"
            />
          </div>
        </div>

        {/* FIELD 2: Property Type ("Ready to move in" / "Under construction") */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-semibold text-[#212121]">
                Construction stage
              </label>
              <button
                type="button"
                onClick={() => toggleTooltip('type')}
                className="text-[#a3a3a3] hover:text-[#4a4a4a] p-0.5 cursor-pointer"
                aria-label="Explain construction stage"
              >
                <HelpCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>
            <span className="text-[11px] text-[#838383]">
              {propertyType === 'under_construction' ? '5% GST applies' : '0% GST (with OC)'}
            </span>
          </div>

          {activeTooltip === 'type' && (
            <p className="text-[11px] text-[#6b6b6b] bg-[#f9f9f9] p-2.5 rounded-lg border border-[#eeeeee] leading-normal animate-in fade-in duration-100">
              Under Indian tax law, ready-to-move properties with an Occupancy Certificate (OC) attract zero GST. Under-construction homes carry 5% GST.
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPropertyType('under_construction')}
              className={`py-3 px-3 rounded-full border text-xs font-mono font-semibold transition-colors cursor-pointer min-h-[44px] flex items-center justify-center gap-1.5 ${
                propertyType === 'under_construction'
                  ? 'border-[#212121] bg-[#212121] text-white font-bold shadow-xs'
                  : 'border-[#eeeeee] bg-white text-[#4a4a4a] hover:border-[#c9c9c9]'
              }`}
            >
              <span>Under construction</span>
            </button>
            <button
              type="button"
              onClick={() => setPropertyType('ready')}
              className={`py-3 px-3 rounded-full border text-xs font-mono font-semibold transition-colors cursor-pointer min-h-[44px] flex items-center justify-center gap-1.5 ${
                propertyType === 'ready'
                  ? 'border-[#212121] bg-[#212121] text-white font-bold shadow-xs'
                  : 'border-[#eeeeee] bg-white text-[#4a4a4a] hover:border-[#c9c9c9]'
              }`}
            >
              <span>Ready to move in</span>
            </button>
          </div>
        </div>

        {/* FIELD 3: Down payment % (slider, default 20%) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <label htmlFor="downPaymentSlider" className="text-xs font-semibold text-[#212121]">
                Down payment: {downPaymentPct}%
              </label>
              <button
                type="button"
                onClick={() => toggleTooltip('downPayment')}
                className="text-[#a3a3a3] hover:text-[#4a4a4a] p-0.5 cursor-pointer"
                aria-label="Explain down payment"
              >
                <HelpCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>
            <span className="text-xs font-bold text-[#212121]">
              {formatIndianCurrency((propertyPrice * downPaymentPct) / 100)}
            </span>
          </div>

          {activeTooltip === 'downPayment' && (
            <p className="text-[11px] text-[#6b6b6b] bg-[#f9f9f9] p-2.5 rounded-lg border border-[#eeeeee] leading-normal animate-in fade-in duration-100">
              The upfront cash amount you contribute from your savings. In India, most banks require at least 15% to 20% down payment.
            </p>
          )}

          <input
            id="downPaymentSlider"
            type="range"
            min={10}
            max={50}
            step={5}
            value={downPaymentPct}
            onChange={(e) => setDownPaymentPct(Number(e.target.value))}
            className="w-full accent-[#212121] cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-[#a3a3a3]">
            <span>10% (Minimum)</span>
            <span>20% (Recommended)</span>
            <span>50% (Conservative)</span>
          </div>
        </div>

        {/* FIELD 4: Loan: interest rate % and years + "Skip loan" toggle */}
        <div className="space-y-3 pt-2 border-t border-[#f2f2f2]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-[#212121]">
                Home loan settings
              </span>
              <button
                type="button"
                onClick={() => toggleTooltip('loan')}
                className="text-[#a3a3a3] hover:text-[#4a4a4a] p-0.5 cursor-pointer"
                aria-label="Explain home loan"
              >
                <HelpCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>

            {/* "Skip loan" Toggle */}
            <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-[#6b6b6b]">
              <input
                type="checkbox"
                checked={isLoanSkipped}
                onChange={(e) => setIsLoanSkipped(e.target.checked)}
                className="w-4 h-4 rounded text-[#212121] focus:ring-[#212121] cursor-pointer"
              />
              <span>Skip loan (100% self-funded)</span>
            </label>
          </div>

          {activeTooltip === 'loan' && (
            <p className="text-[11px] text-[#6b6b6b] bg-[#f9f9f9] p-2.5 rounded-lg border border-[#eeeeee] leading-normal animate-in fade-in duration-100">
              Housing loans in India are typically floating rate. Enter current bank interest rate and planned tenure.
            </p>
          )}

          {!isLoanSkipped && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] text-[#838383] mb-1">
                  Interest rate (% per year)
                </label>
                <input
                  type="number"
                  step={0.05}
                  min={6}
                  max={15}
                  value={interestRatePct}
                  onChange={(e) => setInterestRatePct(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#eeeeee] bg-white text-xs sm:text-sm font-semibold text-[#212121] focus:outline-none focus:border-[#212121] min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#838383] mb-1">
                  Loan tenure (Years)
                </label>
                <select
                  value={loanTenureYears}
                  onChange={(e) => setLoanTenureYears(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#eeeeee] bg-white text-xs sm:text-sm font-semibold text-[#212121] focus:outline-none focus:border-[#212121] min-h-[44px]"
                >
                  <option value={10}>10 Years (120 Months)</option>
                  <option value={15}>15 Years (180 Months)</option>
                  <option value={20}>20 Years (240 Months)</option>
                  <option value={25}>25 Years (300 Months)</option>
                  <option value={30}>30 Years (360 Months)</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. RESULT (LARGE SERIF HEADLINE + ONE PLAIN LINE) */}
      {/* ============================================================ */}
      {propertyPrice > 0 ? (
        <div className="bg-[#212121] border-2 border-[#212121] rounded-3xl p-6 sm:p-8 space-y-3 text-white shadow-xl">
          <span className="text-xs uppercase font-mono font-bold tracking-wider text-white block">
            Acquisition Total
          </span>

          <div className="font-heading text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-white leading-tight">
            You&apos;ll actually pay about {formatIndianCurrency(roundToThousand(result.totalAcquisitionCost))}
          </div>

          <p className="text-sm sm:text-base text-[#AAAAAA] font-medium pt-1 font-sans">
            That is <strong className="text-white">{formatIndianCurrency(roundToThousand(result.totalExtraAboveBase))}</strong> more than the listed price ({formatFriendlyLakhCrore(result.totalExtraAboveBase)} extra).
          </p>
        </div>
      ) : (
        <div className="bg-[#f9f9f9] border border-[#eeeeee] rounded-xl p-6 text-[#6b6b6b] text-sm">
          Please enter a property base price above to view your actual out-of-pocket acquisition calculation.
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. WHERE THE EXTRA GOES (ORDERED LIST + STACKED BAR) */}
      {/* ============================================================ */}
      {propertyPrice > 0 && (
        <div className="bg-white rounded-xl border border-[#eeeeee] p-5 sm:p-7 space-y-6">
          <div className="space-y-1">
            <h3 className="font-medium text-xl text-[#212121]">
              Where the extra goes
            </h3>
            <p className="text-xs text-[#838383]">
              Mandatory government registration duties, statutory taxes, and developer deposits.
            </p>
          </div>

          {/* Thin horizontal stacked bar (pure CSS, no chart library) */}
          <div className="space-y-1.5">
            <div className="h-3 w-full bg-[#f2f2f2] rounded-full overflow-hidden flex">
              <div
                style={{ width: `${basePct}%` }}
                className="bg-[#212121]"
                title={`Base price: ${basePct}%`}
              />
              <div
                style={{ width: `${stampRegPct}%` }}
                className="bg-[#212121]"
                title={`Stamp & Registration: ${stampRegPct}%`}
              />
              {gstPct > 0 && (
                <div
                  style={{ width: `${gstPct}%` }}
                  className="bg-amber-500"
                  title={`GST: ${gstPct}%`}
                />
              )}
              {otherPct > 0 && (
                <div
                  style={{ width: `${otherPct}%` }}
                  className="bg-[#a3a3a3]"
                  title={`Other: ${otherPct}%`}
                />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#6b6b6b]">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#212121]" />
                <span>Base price ({basePct}%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#212121]" />
                <span>Stamp & Reg ({stampRegPct}%)</span>
              </div>
              {gstPct > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>GST ({gstPct}%)</span>
                </div>
              )}
              {otherPct > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#a3a3a3]" />
                  <span>Other ({otherPct}%)</span>
                </div>
              )}
            </div>
          </div>

          {/* Simple Ordered List with Amounts */}
          <div className="divide-y divide-[#eeeeee] text-xs sm:text-sm">
            {/* 1. Stamp Duty */}
            <div className="py-3 flex items-center justify-between">
              <div>
                <div className="font-semibold text-[#212121]">
                  1. Stamp duty ({settings.stampDutyPct}%)
                </div>
                <div className="text-[11px] text-[#838383]">
                  Telangana State Government revenue stamp on sale deed.
                </div>
              </div>
              <div className="font-bold text-[#212121]">
                about {formatIndianCurrency(roundToThousand(result.stampDuty))}
              </div>
            </div>

            {/* 2. Transfer Duty */}
            <div className="py-3 flex items-center justify-between">
              <div>
                <div className="font-semibold text-[#212121]">
                  2. Transfer duty ({settings.transferDutyPct}%)
                </div>
                <div className="text-[11px] text-[#838383]">
                  Local body development surcharge on title deed transfer.
                </div>
              </div>
              <div className="font-bold text-[#212121]">
                about {formatIndianCurrency(roundToThousand(result.transferDuty))}
              </div>
            </div>

            {/* 3. Registration Fee */}
            <div className="py-3 flex items-center justify-between">
              <div>
                <div className="font-semibold text-[#212121]">
                  3. Registration fee ({settings.registrationPct}%)
                </div>
                <div className="text-[11px] text-[#838383]">
                  Sub-registrar office recording fee for legal title documentation.
                </div>
              </div>
              <div className="font-bold text-[#212121]">
                about {formatIndianCurrency(roundToThousand(result.registrationFee))}
              </div>
            </div>

            {/* 4. GST */}
            <div className="py-3 flex items-center justify-between">
              <div>
                <div className="font-semibold text-[#212121]">
                  4. Goods and Services Tax (GST)
                </div>
                <div className="text-[11px] text-[#838383]">
                  {propertyType === 'under_construction'
                    ? `${settings.gstUnderConstructionPct}% levied on under-construction housing.`
                    : '0% levied on ready-to-move property with Occupancy Certificate.'}
                </div>
              </div>
              <div className="font-bold text-[#212121]">
                {result.gst > 0 ? `about ${formatIndianCurrency(roundToThousand(result.gst))}` : '₹0 (Exempt with OC)'}
              </div>
            </div>

            {/* 5. Other Costs */}
            <div className="py-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[#212121]">
                    5. Other builder charges & deposits
                  </div>
                  <div className="text-[11px] text-[#838383]">
                    Car parking allotment, society corpus deposit, and clubhouse amenity fee.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#212121]">
                    about {formatIndianCurrency(roundToThousand(result.otherCosts))}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsOtherCostsOpen(!isOtherCostsOpen)}
                    className="text-xs text-[#212121] font-semibold hover:underline cursor-pointer"
                  >
                    {isOtherCostsOpen ? 'Hide' : 'Edit breakdown'}
                  </button>
                </div>
              </div>

              {/* 3 Optional Inputs (Default 0 or standard) */}
              {isOtherCostsOpen && (
                <div className="p-4 bg-[#f9f9f9] rounded-xl border border-[#eeeeee] grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-100">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#6b6b6b] mb-1">
                      Car parking allotment (₹)
                    </label>
                    <input
                      type="number"
                      step={50000}
                      min={0}
                      value={parkingCost}
                      onChange={(e) => setParkingCost(Math.max(0, Number(e.target.value)))}
                      className="w-full px-3 py-2 rounded-lg border border-[#eeeeee] bg-white text-xs font-semibold focus:outline-none focus:border-[#212121]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#6b6b6b] mb-1">
                      Corpus / Maintenance deposit (₹)
                    </label>
                    <input
                      type="number"
                      step={25000}
                      min={0}
                      value={maintenanceDeposit}
                      onChange={(e) => setMaintenanceDeposit(Math.max(0, Number(e.target.value)))}
                      className="w-full px-3 py-2 rounded-lg border border-[#eeeeee] bg-white text-xs font-semibold focus:outline-none focus:border-[#212121]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#6b6b6b] mb-1">
                      Clubhouse membership fee (₹)
                    </label>
                    <input
                      type="number"
                      step={25000}
                      min={0}
                      value={clubhouseFee}
                      onChange={(e) => setClubhouseFee(Math.max(0, Number(e.target.value)))}
                      className="w-full px-3 py-2 rounded-lg border border-[#eeeeee] bg-white text-xs font-semibold focus:outline-none focus:border-[#212121]"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. LOAN SUMMARY CARD (WHEN LOAN NOT SKIPPED) */}
      {/* ============================================================ */}
      {!isLoanSkipped && propertyPrice > 0 && (
        <div className="bg-white rounded-xl border border-[#eeeeee] p-5 sm:p-7 space-y-4">
          <div className="space-y-1">
            <h3 className="font-medium text-xl text-[#212121]">
              Loan & Monthly Cashflow Breakdown
            </h3>
            <p className="text-xs text-[#6b6b6b]">
              EMI is your fixed monthly payment to the bank.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-[#f9f9f9] border border-[#eeeeee]">
              <span className="text-[11px] text-[#838383] block mb-1">Monthly EMI</span>
              <span className="text-lg sm:text-xl font-bold text-[#212121]">
                about {formatIndianCurrency(roundToThousand(result.monthlyEmi))}
              </span>
              <span className="text-[10px] text-[#a3a3a3] block mt-0.5">per month for {loanTenureYears} years</span>
            </div>

            <div className="p-4 rounded-xl bg-[#f9f9f9] border border-[#eeeeee]">
              <span className="text-[11px] text-[#838383] block mb-1">Total Loan Interest</span>
              <span className="text-lg sm:text-xl font-bold text-[#212121]">
                about {formatIndianCurrency(roundToThousand(result.totalLoanInterest))}
              </span>
              <span className="text-[10px] text-[#a3a3a3] block mt-0.5">paid to lender over tenure</span>
            </div>

            <div className="p-4 rounded-xl bg-[#f9f9f9] border border-[#eeeeee]">
              <span className="text-[11px] text-[#838383] block mb-1">Total Cost of Owning</span>
              <span className="text-lg sm:text-xl font-bold text-[#212121]">
                about {formatIndianCurrency(roundToThousand(result.totalCostWithInterest))}
              </span>
              <span className="text-[10px] text-[#a3a3a3] block mt-0.5">base + taxes + loan interest</span>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 5. NRI NOTE (COLLAPSED BY DEFAULT, 3 SHORT BULLETS) */}
      {/* ============================================================ */}
      <div className="bg-white rounded-xl border border-[#eeeeee] overflow-hidden">
        <button
          type="button"
          onClick={() => setIsNriExpanded(!isNriExpanded)}
          className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-3 hover:bg-[#f9f9f9] transition-colors cursor-pointer min-h-[48px]"
        >
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-[#212121]" strokeWidth={1.5} />
            <span className="font-semibold text-sm text-[#212121]">
              Buying from abroad?
            </span>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-[#a3a3a3] transition-transform duration-150 ${
              isNriExpanded ? 'rotate-180' : ''
            }`}
            strokeWidth={1.5}
          />
        </button>

        {isNriExpanded && (
          <div className="p-5 pt-0 border-t border-[#f2f2f2] text-xs text-[#4a4a4a] space-y-3 leading-relaxed animate-in fade-in duration-150">
            <ul className="space-y-2 list-disc list-outside pl-4">
              <li>
                <strong>Designated Bank Accounts:</strong> Payments generally flow through Non-Resident External (NRE) or Non-Resident Ordinary (NRO) accounts under Reserve Bank of India (RBI) guidelines.
              </li>
              <li>
                <strong>Tax & Withholding Obligations:</strong> Tax rules apply on rental income generated in India and on capital gains upon sale, including mandatory Tax Deducted at Source (TDS).
              </li>
              <li>
                <strong>Repatriation of Funds:</strong> Clear rules on moving sale proceeds back to your country of residence exist under Foreign Exchange Management Act (FEMA) documentation.
              </li>
            </ul>

            <p className="text-[11px] text-[#838383] italic pt-1 border-t border-[#f2f2f2]">
              General information only. Confirm with a chartered accountant before you act.
            </p>
          </div>
        )}
      </div>

      {/* Advisor Consultation CTA */}
      <div className="p-6 bg-white rounded-xl border border-[#eeeeee] space-y-3">
        <h4 className="font-medium text-base text-[#212121]">
          Need help reviewing a builder&apos;s cost sheet?
        </h4>
        <p className="text-xs text-[#6b6b6b] leading-relaxed">
          Builders often bundle floor-rise charges, preferred location charges (PLC), and clubhouse GST. Have an expert go through the sheet line by line.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('booking')}
          className="w-full sm:w-auto min-h-[48px] px-6 py-2.5 rounded-full bg-[#212121] hover:bg-black text-white text-xs sm:text-sm font-bold font-mono uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
        >
          <PhoneCall className="w-4 h-4 text-white" strokeWidth={2} />
          <span>Talk to an Advisor about your numbers</span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* 6. FOOTER LINE + "EDIT RATES (HOI STAFF)" LINK */}
      {/* ============================================================ */}
      <div className="pt-4 border-t border-[#eeeeee] text-xs text-[#838383] space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <p>
            Rates last updated: <strong>{settings.ratesUpdatedOn}</strong>. Verify with the Telangana Registration & Stamps Department.
          </p>

          <button
            type="button"
            onClick={() => setIsStaffEditorOpen(!isStaffEditorOpen)}
            className="text-[11px] text-[#212121] font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            <Settings2 className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>{isStaffEditorOpen ? 'Close staff editor' : 'Edit rates (staff)'}</span>
          </button>
        </div>

        {/* Live Staff Editor Drawer */}
        {isStaffEditorOpen && (
          <div className="p-4 mt-2 bg-[#f2f2f2] rounded-xl border border-[#e0e0e0] space-y-3 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#212121] text-xs uppercase tracking-wider">
                Internal rate parameters
              </span>
              <button
                type="button"
                onClick={() => setSettings(DEFAULT_COST_SETTINGS)}
                className="text-[11px] text-[#838383] hover:text-[#212121] underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" strokeWidth={1.5} />
                <span>Reset to defaults</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <label className="block text-[10px] text-[#838383]">Stamp Duty (%)</label>
                <input
                  type="number"
                  step={0.1}
                  value={settings.stampDutyPct}
                  onChange={(e) => setSettings({ ...settings, stampDutyPct: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 bg-white rounded border border-[#eeeeee] text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] text-[#838383]">Transfer Duty (%)</label>
                <input
                  type="number"
                  step={0.1}
                  value={settings.transferDutyPct}
                  onChange={(e) => setSettings({ ...settings, transferDutyPct: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 bg-white rounded border border-[#eeeeee] text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] text-[#838383]">Registration (%)</label>
                <input
                  type="number"
                  step={0.1}
                  value={settings.registrationPct}
                  onChange={(e) => setSettings({ ...settings, registrationPct: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 bg-white rounded border border-[#eeeeee] text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] text-[#838383]">GST Under-Const (%)</label>
                <input
                  type="number"
                  step={0.5}
                  value={settings.gstUnderConstructionPct}
                  onChange={(e) => setSettings({ ...settings, gstUnderConstructionPct: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 bg-white rounded border border-[#eeeeee] text-xs font-semibold"
                />
              </div>
            </div>
            <p className="text-[10px] text-[#838383]">
              Changes reflect live across all formulas above.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
