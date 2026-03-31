import { ProjectInputs, Scenario, SCENARIO_MULTIPLIERS } from "./types";

// ─── Constants ───────────────────────────────────────────────
const DAYS_PER_MONTH = 30;
const MONTHS_PER_YEAR = 12;
const PEAK_RATIO = 0.4;
const OFFPEAK_RATIO = 0.6;

// ─── Safe math helpers ───────────────────────────────────────
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const safe = (n: number, fallback = 0): number => finite(n) ? n : fallback;

function safeDiv(num: number, den: number, fallback: number | null = null): number | null {
  if (!finite(num) || !finite(den) || den === 0) return fallback;
  const result = num / den;
  return finite(result) ? result : fallback;
}

// ─── Metric status (for UI rendering) ────────────────────────
export type MetricStatus = "valid" | "invalid" | "incomplete";

export interface SafeMetric {
  value: number | null;
  status: MetricStatus;
}

function makeSafeMetric(value: number | null, inputsPresent = true): SafeMetric {
  if (!inputsPresent) return { value: null, status: "incomplete" };
  if (value === null || !finite(value)) return { value: null, status: "invalid" };
  return { value, status: "valid" };
}

// ─── KPI result shape ────────────────────────────────────────
export interface KPIResult {
  totalInvestment: number;

  // Monthly
  totalHoursMonth: number;
  peakHoursMonth: number;
  offPeakHoursMonth: number;
  courtRevenueMonth: number;
  otherRevenueMonth: number;
  totalRevenueMonth: number;
  ebitdaMonth: number;
  loanPaymentMonth: number;
  netCashflowMonth: number;

  // Annual
  totalRevenueYear: number;
  ebitdaYear: number;
  netCashflowYear: number;

  // Safe metrics (with status)
  ebitdaMargin: SafeMetric;
  roi: SafeMetric;
  paybackYears: SafeMetric;
  breakEvenOccupancy: SafeMetric;
  weightedOccupancy: number;

  // Financing
  loanAmount: number;

  // For charts
  annualCourtRevenue: number;
  annualOtherRevenue: number;
  annualCosts: number;
}

// ─── Formatting helpers (safe for UI) ────────────────────────
export function formatSafePct(m: SafeMetric, decimals = 0): string {
  if (m.status !== "valid" || m.value === null) return "—";
  return `${m.value.toFixed(decimals)}%`;
}

export function formatSafeYears(m: SafeMetric): string {
  if (m.status !== "valid" || m.value === null) return "N/A";
  return `${m.value.toFixed(1)} years`;
}

export function isSafeValid(m: SafeMetric): boolean {
  return m.status === "valid" && m.value !== null;
}

// ─── Loan payment (standard amortisation formula) ────────────
function calcMonthlyLoanPayment(principal: number, annualRate: number, years: number): number {
  if (!finite(principal) || principal <= 0 || !finite(years) || years <= 0) return 0;
  if (!finite(annualRate) || annualRate <= 0) return principal / (years * MONTHS_PER_YEAR);

  const r = annualRate / 100 / MONTHS_PER_YEAR;
  const n = years * MONTHS_PER_YEAR;
  const factor = Math.pow(1 + r, n);
  if (!finite(factor) || factor === 1) return principal / n;
  return principal * (r * factor) / (factor - 1);
}

// ─── Main KPI calculation ────────────────────────────────────
export function calculateKPIs(inputs: ProjectInputs, scenario: Scenario): KPIResult {
  const m = SCENARIO_MULTIPLIERS[scenario];

  // Sanitise inputs
  const courts = safe(inputs.numberOfCourts);
  const hoursPerDay = safe(inputs.openingHoursPerDay);
  const peakOccInput = safe(inputs.peakOccupancy);
  const offPeakOccInput = safe(inputs.offPeakOccupancy);
  const peakPriceInput = safe(inputs.peakPrice);
  const offPeakPriceInput = safe(inputs.offPeakPrice);
  const investment = safe(inputs.initialInvestment);
  const monthlyOpCosts = safe(inputs.monthlyOperatingCosts);
  const debtPct = safe(inputs.debtPercentage);
  const intRate = safe(inputs.interestRate);
  const loanTerm = safe(inputs.loanTermYears);

  // Scenario adjustments
  const peakOcc = Math.min(100, Math.max(0, peakOccInput + m.occupancyOffset)) / 100;
  const offPeakOcc = Math.min(100, Math.max(0, offPeakOccInput + m.occupancyOffset)) / 100;
  const peakPrice = peakPriceInput * m.pricingMultiplier;
  const offPeakPrice = offPeakPriceInput * m.pricingMultiplier;

  // Step 1: Capacity
  const totalHoursMonth = courts * hoursPerDay * DAYS_PER_MONTH;
  const peakHoursMonth = totalHoursMonth * PEAK_RATIO;
  const offPeakHoursMonth = totalHoursMonth * OFFPEAK_RATIO;

  // Step 2: Court revenue
  const courtRevenueMonth = safe(peakHoursMonth * peakOcc * peakPrice) + safe(offPeakHoursMonth * offPeakOcc * offPeakPrice);

  // Step 3: Total revenue
  const otherRevenueMonth = safe(inputs.otherMonthlyRevenue) + safe(inputs.proshopRevenue) + safe(inputs.fAndBRevenue) + safe(inputs.membershipFees);
  const totalRevenueMonth = courtRevenueMonth + otherRevenueMonth;
  const totalRevenueYear = totalRevenueMonth * MONTHS_PER_YEAR;

  // Step 4: EBITDA
  const ebitdaMonth = totalRevenueMonth - monthlyOpCosts;
  const ebitdaYear = ebitdaMonth * MONTHS_PER_YEAR;
  const ebitdaMarginRaw = safeDiv(ebitdaMonth, totalRevenueMonth);
  const ebitdaMargin = makeSafeMetric(
    ebitdaMarginRaw !== null ? ebitdaMarginRaw * 100 : null,
    totalRevenueMonth > 0
  );

  // Step 5: Financing
  const loanAmount = investment * (debtPct / 100);
  const loanPaymentMonth = calcMonthlyLoanPayment(loanAmount, intRate, loanTerm);

  // Step 6: Net cashflow
  const netCashflowMonth = ebitdaMonth - safe(loanPaymentMonth);
  const netCashflowYear = netCashflowMonth * MONTHS_PER_YEAR;

  // Step 7: ROI
  const roiRaw = safeDiv(ebitdaYear, investment);
  const roi = makeSafeMetric(
    roiRaw !== null ? roiRaw * 100 : null,
    investment > 0
  );

  // Step 8: Payback
  const paybackRaw = ebitdaYear > 0 ? safeDiv(investment, ebitdaYear) : null;
  const paybackYears = makeSafeMetric(paybackRaw, ebitdaYear > 0);

  // Step 9: Break-even occupancy
  const courtRevenueAt100 = (peakHoursMonth * peakPrice) + (offPeakHoursMonth * offPeakPrice);
  const requiredRevenue = monthlyOpCosts + safe(loanPaymentMonth);
  const hasCapacity = courtRevenueAt100 > 0 && finite(courtRevenueAt100);
  const breakEvenRaw = hasCapacity
    ? ((requiredRevenue - otherRevenueMonth) / courtRevenueAt100) * 100
    : null;
  const breakEvenClamped = breakEvenRaw !== null && finite(breakEvenRaw)
    ? Math.max(0, Math.min(100, breakEvenRaw))
    : null;
  const breakEvenOccupancy = makeSafeMetric(breakEvenClamped, hasCapacity);

  // Weighted current occupancy
  const weightedOccupancy = Math.min(100, Math.max(0,
    (peakOccInput * PEAK_RATIO + offPeakOccInput * OFFPEAK_RATIO) + m.occupancyOffset
  ));

  return {
    totalInvestment: investment,
    totalHoursMonth,
    peakHoursMonth,
    offPeakHoursMonth,
    courtRevenueMonth,
    otherRevenueMonth,
    totalRevenueMonth,
    ebitdaMonth,
    loanPaymentMonth: safe(loanPaymentMonth),
    netCashflowMonth,
    totalRevenueYear,
    ebitdaYear,
    netCashflowYear,
    ebitdaMargin,
    roi,
    paybackYears,
    breakEvenOccupancy,
    weightedOccupancy,
    loanAmount: safe(loanAmount),
    annualCourtRevenue: courtRevenueMonth * MONTHS_PER_YEAR,
    annualOtherRevenue: otherRevenueMonth * MONTHS_PER_YEAR,
    annualCosts: monthlyOpCosts * MONTHS_PER_YEAR,
  };
}

// ─── Monthly evolution ───────────────────────────────────────
export function getMonthlyEvolution(inputs: ProjectInputs, scenario: Scenario) {
  const kpis = calculateKPIs(inputs, scenario);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const seasonality = [0.7, 0.75, 0.85, 0.9, 1.0, 1.1, 1.15, 1.1, 1.05, 0.95, 0.85, 0.8];

  return months.map((month, i) => {
    const revenue = Math.round(kpis.totalRevenueMonth * seasonality[i]);
    const costs = Math.round(kpis.ebitdaMonth < kpis.totalRevenueMonth ? (kpis.totalRevenueMonth - kpis.ebitdaMonth) : 0);
    return { month, revenue, costs, profit: revenue - costs };
  });
}