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

// ─── Cost breakdown ──────────────────────────────────────────
export interface CostBreakdown {
  fixedCosts: number;   // monthly
  variableCosts: number; // monthly
  totalCosts: number;    // monthly
  details: {
    staff: number;
    rent: number;
    software: number;
    energy: number;
    maintenance: number;
    cleaning: number;
    marketing: number;
    insurance: number;
  };
}

function calculateCostBreakdown(inputs: ProjectInputs, totalHoursMonth: number, bookedHoursMonth: number): CostBreakdown {
  const courts = safe(inputs.numberOfCourts);

  if (inputs.costMode === "detailed") {
    const staff = safe(inputs.staffCostPerCourtHour) * totalHoursMonth;
    const rent = safe(inputs.rentOrMortgage);
    const software = safe(inputs.softwareManagementCost);
    const fixedCosts = staff + rent + software;

    const energy = safe(inputs.energyCostPerHour) * totalHoursMonth;
    const maintenance = safe(inputs.maintenanceCostPerUsage) * bookedHoursMonth;
    const cleaning = safe(inputs.cleaningCostPerDay) * courts * DAYS_PER_MONTH;
    const variableCosts = energy + maintenance + cleaning;

    return {
      fixedCosts,
      variableCosts,
      totalCosts: fixedCosts + variableCosts + safe(inputs.marketingCosts) + safe(inputs.insuranceCosts),
      details: { staff, rent, software, energy, maintenance, cleaning, marketing: safe(inputs.marketingCosts), insurance: safe(inputs.insuranceCosts) },
    };
  }

  // Basic mode — use monthlyOperatingCosts as-is
  const total = safe(inputs.monthlyOperatingCosts);
  return {
    fixedCosts: total * 0.65, // approximate split
    variableCosts: total * 0.35,
    totalCosts: total,
    details: {
      staff: safe(inputs.staffCosts),
      rent: safe(inputs.rentOrMortgage),
      software: 0,
      energy: safe(inputs.utilitiesCosts),
      maintenance: safe(inputs.maintenanceCosts),
      cleaning: 0,
      marketing: safe(inputs.marketingCosts),
      insurance: safe(inputs.insuranceCosts),
    },
  };
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

  // Cost breakdown
  costBreakdown: CostBreakdown;
}

// ─── Delta impact (causal feedback) ──────────────────────────
export interface DriverDelta {
  key: string;
  label: string;
  annualRevenueImpact: number;
  ebitdaImpact: number;
  paybackImpact: number | null;
}

export function calculateDriverDeltas(inputs: ProjectInputs, scenario: Scenario): Record<string, DriverDelta> {
  const base = calculateKPIs(inputs, scenario);
  const deltas: Record<string, DriverDelta> = {};

  const tests: { key: keyof ProjectInputs; label: string; delta: number }[] = [
    { key: "peakOccupancy", label: "Peak Occupancy +5%", delta: 5 },
    { key: "offPeakOccupancy", label: "Off-Peak Occupancy +5%", delta: 5 },
    { key: "peakPrice", label: "Peak Price +€2", delta: 2 },
    { key: "offPeakPrice", label: "Off-Peak Price +€2", delta: 2 },
    { key: "numberOfCourts", label: "+1 Court", delta: 1 },
    { key: "openingHoursPerDay", label: "+1 Hour/Day", delta: 1 },
  ];

  for (const t of tests) {
    const tweaked = { ...inputs, [t.key]: (inputs[t.key] as number) + t.delta };
    const alt = calculateKPIs(tweaked, scenario);

    let paybackImpact: number | null = null;
    if (isSafeValid(base.paybackYears) && isSafeValid(alt.paybackYears)) {
      paybackImpact = alt.paybackYears.value! - base.paybackYears.value!;
    }

    deltas[t.key] = {
      key: t.key,
      label: t.label,
      annualRevenueImpact: alt.totalRevenueYear - base.totalRevenueYear,
      ebitdaImpact: alt.ebitdaYear - base.ebitdaYear,
      paybackImpact,
    };
  }
  return deltas;
}

// ─── Sensitivity ranking ─────────────────────────────────────
export interface SensitivityRank {
  key: string;
  label: string;
  ebitdaImpact: number;
}

export function calculateSensitivityRanking(inputs: ProjectInputs, scenario: Scenario): SensitivityRank[] {
  const deltas = calculateDriverDeltas(inputs, scenario);
  return Object.values(deltas)
    .map((d) => ({ key: d.key, label: d.label, ebitdaImpact: Math.abs(d.ebitdaImpact) }))
    .sort((a, b) => b.ebitdaImpact - a.ebitdaImpact)
    .slice(0, 3);
}

// ─── Decision insight ────────────────────────────────────────
export function generateInsight(kpis: KPIResult, inputs: ProjectInputs): string {
  const parts: string[] = [];

  // Find main driver
  const marginVal = isSafeValid(kpis.ebitdaMargin) ? kpis.ebitdaMargin.value! : null;

  if (kpis.totalRevenueYear > 0) {
    const courtShare = kpis.annualCourtRevenue / kpis.totalRevenueYear;
    if (courtShare > 0.7) {
      parts.push("Profitability is mainly driven by court rental occupancy and pricing.");
    } else {
      parts.push("Revenue is well diversified across court rental and ancillary streams.");
    }
  }

  if (marginVal !== null && marginVal > 55) {
    parts.push("Current margins are unusually high — verify that cost assumptions reflect real operating expenses.");
  } else if (marginVal !== null && marginVal < 15) {
    parts.push("Thin margins suggest costs may need optimisation or revenue needs to increase.");
  }

  if (isSafeValid(kpis.paybackYears) && kpis.paybackYears.value! < 1) {
    parts.push("Payback under 1 year is extremely aggressive — double-check investment and cost inputs.");
  }

  if (inputs.costMode === "basic") {
    parts.push("Switch to detailed cost mode for a more realistic breakdown.");
  }

  return parts.length > 0 ? parts.join(" ") : "Model looks balanced. Adjust key drivers to explore scenarios.";
}

// ─── Scenario comparison ─────────────────────────────────────
export interface ScenarioDelta {
  ebitdaPctChange: number | null;
  paybackDelta: number | null;
  revenuePctChange: number | null;
}

export function calculateScenarioDelta(inputs: ProjectInputs, scenario: Scenario): ScenarioDelta | null {
  if (scenario === "base") return null;
  const base = calculateKPIs(inputs, "base");
  const current = calculateKPIs(inputs, scenario);

  const ebitdaPctChange = base.ebitdaYear !== 0 ? ((current.ebitdaYear - base.ebitdaYear) / Math.abs(base.ebitdaYear)) * 100 : null;
  const paybackDelta = isSafeValid(current.paybackYears) && isSafeValid(base.paybackYears)
    ? current.paybackYears.value! - base.paybackYears.value!
    : null;
  const revenuePctChange = base.totalRevenueYear !== 0 ? ((current.totalRevenueYear - base.totalRevenueYear) / Math.abs(base.totalRevenueYear)) * 100 : null;

  return { ebitdaPctChange, paybackDelta, revenuePctChange };
}

// ─── Scenario comparison (full side-by-side) ─────────────────
export interface ScenarioComparison {
  base: KPIResult;
  current: KPIResult;
  revenueDelta: number;
  ebitdaDelta: number;
  paybackDelta: number | null;
  roiDelta: number | null;
}

export function calculateScenarioComparison(inputs: ProjectInputs, scenario: Scenario): ScenarioComparison {
  const base = calculateKPIs(inputs, "base");
  const current = calculateKPIs(inputs, scenario);

  return {
    base,
    current,
    revenueDelta: current.totalRevenueYear - base.totalRevenueYear,
    ebitdaDelta: current.ebitdaYear - base.ebitdaYear,
    paybackDelta: isSafeValid(current.paybackYears) && isSafeValid(base.paybackYears)
      ? current.paybackYears.value! - base.paybackYears.value! : null,
    roiDelta: isSafeValid(current.roi) && isSafeValid(base.roi)
      ? current.roi.value! - base.roi.value! : null,
  };
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

// ─── Validation warnings ─────────────────────────────────────
export interface ValidationWarning {
  id: string;
  message: string;
  severity: "warning" | "error";
}

export function getValidationWarnings(kpis: KPIResult): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const marginVal = isSafeValid(kpis.ebitdaMargin) ? kpis.ebitdaMargin.value! : null;

  if (marginVal !== null && marginVal > 55) {
    warnings.push({ id: "high-margin", message: "Unusually high margin — check cost assumptions", severity: "warning" });
  }
  if (isSafeValid(kpis.paybackYears) && kpis.paybackYears.value! < 1) {
    warnings.push({ id: "fast-payback", message: "Unrealistic payback — verify inputs", severity: "error" });
  }
  return warnings;
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

  // Step 4: Cost breakdown
  const bookedHoursMonth = (peakHoursMonth * peakOcc) + (offPeakHoursMonth * offPeakOcc);
  const costBreakdown = calculateCostBreakdown(inputs, totalHoursMonth, bookedHoursMonth);
  const monthlyCosts = costBreakdown.totalCosts;

  // Step 5: EBITDA
  const ebitdaMonth = totalRevenueMonth - monthlyCosts;
  const ebitdaYear = ebitdaMonth * MONTHS_PER_YEAR;
  const ebitdaMarginRaw = safeDiv(ebitdaMonth, totalRevenueMonth);
  const ebitdaMargin = makeSafeMetric(
    ebitdaMarginRaw !== null ? ebitdaMarginRaw * 100 : null,
    totalRevenueMonth > 0
  );

  // Step 6: Financing
  const loanAmount = investment * (debtPct / 100);
  const loanPaymentMonth = calcMonthlyLoanPayment(loanAmount, intRate, loanTerm);

  // Step 7: Net cashflow
  const netCashflowMonth = ebitdaMonth - safe(loanPaymentMonth);
  const netCashflowYear = netCashflowMonth * MONTHS_PER_YEAR;

  // Step 8: ROI
  const roiRaw = safeDiv(ebitdaYear, investment);
  const roi = makeSafeMetric(
    roiRaw !== null ? roiRaw * 100 : null,
    investment > 0
  );

  // Step 9: Payback
  const paybackRaw = ebitdaYear > 0 ? safeDiv(investment, ebitdaYear) : null;
  const paybackYears = makeSafeMetric(paybackRaw, ebitdaYear > 0);

  // Step 10: Break-even occupancy
  const courtRevenueAt100 = (peakHoursMonth * peakPrice) + (offPeakHoursMonth * offPeakPrice);
  const requiredRevenue = monthlyCosts + safe(loanPaymentMonth);
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
    annualCosts: monthlyCosts * MONTHS_PER_YEAR,
    costBreakdown,
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
