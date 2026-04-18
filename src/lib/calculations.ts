import { ProjectInputs, Scenario, SCENARIO_MULTIPLIERS, DEFAULT_INPUTS, normalizeProjectInputs } from "./types";

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

// ─── Metric status ───────────────────────────────────────────
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
  fixedCosts: number;
  variableCosts: number;
  totalCosts: number;
  details: {
    staff: number; rent: number; software: number;
    energy: number; maintenance: number; cleaning: number;
    marketing: number; insurance: number;
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
      fixedCosts, variableCosts,
      totalCosts: fixedCosts + variableCosts + safe(inputs.marketingCosts) + safe(inputs.insuranceCosts),
      details: { staff, rent, software, energy, maintenance, cleaning, marketing: safe(inputs.marketingCosts), insurance: safe(inputs.insuranceCosts) },
    };
  }
  // Basic mode: fixed costs from inputs + variable costs from booked hours
  const fixedTotal = safe(inputs.staffCosts) + safe(inputs.utilitiesCosts) + safe(inputs.maintenanceCosts) +
    safe(inputs.rentOrMortgage) + safe(inputs.marketingCosts) + safe(inputs.insuranceCosts);
  const variableFromUsage = safe(inputs.variableCostPerHour) * bookedHoursMonth;
  const total = fixedTotal + variableFromUsage;
  return {
    fixedCosts: fixedTotal, variableCosts: variableFromUsage, totalCosts: total,
    details: { staff: safe(inputs.staffCosts), rent: safe(inputs.rentOrMortgage), software: 0, energy: safe(inputs.utilitiesCosts), maintenance: safe(inputs.maintenanceCosts), cleaning: 0, marketing: safe(inputs.marketingCosts), insurance: safe(inputs.insuranceCosts) },
  };
}

// ─── KPI result ──────────────────────────────────────────────
export interface RevenueBreakdown {
  courtRevenue: number;
  courtDirectCost: number;
  courtAllocatedIndirect: number;
  courtEbitda: number;
  courtEbitdaMargin: number;

  coachingRevenue: number;
  coachingCost: number;
  coachingNet: number;
  coachingAllocatedIndirect: number;
  coachingEbitda: number;
  coachingEbitdaMargin: number;

  tournamentsRevenue: number;
  tournamentsCost: number;
  tournamentsNet: number;
  tournamentsAllocatedIndirect: number;
  tournamentsEbitda: number;
  tournamentsEbitdaMargin: number;

  eventsRevenue: number;
  eventsCost: number;
  eventsNet: number;
  eventsAllocatedIndirect: number;
  eventsEbitda: number;
  eventsEbitdaMargin: number;

  // Legacy aliases
  tournamentRevenue: number;
  tournamentCost: number;
  tournamentNet: number;

  otherRevenue: number;
  otherCost: number;
  otherNet: number;
  otherAllocatedIndirect: number;
  otherEbitda: number;
  otherEbitdaMargin: number;

  totalRevenue: number;
  totalDirectCosts: number;
  totalIndirectCosts: number;
  totalEbitda: number;
  addOnEbitda: number;
  addOnPct: number;
  bookingHoursPct: number;
  coachingHoursPct: number;
  capacityWarning: boolean;
}

export interface KPIResult {
  totalInvestment: number;
  totalHoursMonth: number; peakHoursMonth: number; offPeakHoursMonth: number;
  courtRevenueMonth: number; otherRevenueMonth: number; totalRevenueMonth: number;
  ebitdaMonth: number; loanPaymentMonth: number; netCashflowMonth: number;
  totalRevenueYear: number; ebitdaYear: number; netCashflowYear: number;
  ebitdaMargin: SafeMetric; roi: SafeMetric; paybackYears: SafeMetric;
  breakEvenOccupancy: SafeMetric; weightedOccupancy: number;
  loanAmount: number;
  annualCourtRevenue: number; annualOtherRevenue: number; annualCosts: number;
  costBreakdown: CostBreakdown;
  revenueBreakdown: RevenueBreakdown;
  // Investor / financing metrics
  equityInvested: number;
  annualDebtPayment: number;
  totalInterestPaid: number;
  cashFlowToEquity: number;
  roiOnEquity: SafeMetric;
  paybackEquity: SafeMetric;
}

// ─── Driver deltas ───────────────────────────────────────────
export interface DriverDelta {
  key: string; label: string; unit: string;
  annualRevenueImpact: number; ebitdaImpact: number; paybackImpact: number | null;
}

export function calculateDriverDeltas(inputs: ProjectInputs, scenario: Scenario): Record<string, DriverDelta> {
  const base = calculateKPIs(inputs, scenario);
  const deltas: Record<string, DriverDelta> = {};
  const tests: { key: keyof ProjectInputs; label: string; unit: string; delta: number }[] = [
    { key: "peakOccupancy", label: "Peak Occupancy", unit: "+5 pp", delta: 5 },
    { key: "offPeakOccupancy", label: "Off-Peak Occupancy", unit: "+5 pp", delta: 5 },
    { key: "peakPrice", label: "Peak Price", unit: "+€5/h", delta: 5 },
    { key: "offPeakPrice", label: "Off-Peak Price", unit: "+€5/h", delta: 5 },
    { key: "numberOfCourts", label: "Courts", unit: "+1 court", delta: 1 },
    { key: "openingHoursPerDay", label: "Hours/Day", unit: "+1 hour/day", delta: 1 },
  ];
  for (const t of tests) {
    const tweaked = { ...inputs, [t.key]: (inputs[t.key] as number) + t.delta };
    const alt = calculateKPIs(tweaked, scenario);
    let paybackImpact: number | null = null;
    if (isSafeValid(base.paybackYears) && isSafeValid(alt.paybackYears)) {
      paybackImpact = alt.paybackYears.value! - base.paybackYears.value!;
    }
    deltas[t.key] = { key: t.key, label: t.label, unit: t.unit, annualRevenueImpact: alt.totalRevenueYear - base.totalRevenueYear, ebitdaImpact: alt.ebitdaYear - base.ebitdaYear, paybackImpact };
  }
  return deltas;
}

// ─── Consolidated drivers (merge peak/off-peak) ─────────────
export interface ConsolidatedDriver {
  label: string; unit: string; ebitdaImpact: number;
}

export function getConsolidatedDrivers(deltas: Record<string, DriverDelta>): ConsolidatedDriver[] {
  const consolidated: ConsolidatedDriver[] = [];
  // Merge occupancy (average peak + off-peak impact)
  const peakOcc = deltas.peakOccupancy;
  const offPeakOcc = deltas.offPeakOccupancy;
  if (peakOcc && offPeakOcc) {
    consolidated.push({ label: "Occupancy", unit: "+5 pp", ebitdaImpact: (peakOcc.ebitdaImpact + offPeakOcc.ebitdaImpact) / 2 });
  }
  // Merge price
  const peakPrice = deltas.peakPrice;
  const offPeakPrice = deltas.offPeakPrice;
  if (peakPrice && offPeakPrice) {
    consolidated.push({ label: "Price", unit: "+€5/h", ebitdaImpact: (peakPrice.ebitdaImpact + offPeakPrice.ebitdaImpact) / 2 });
  }
  // Courts
  if (deltas.numberOfCourts) {
    consolidated.push({ label: "Courts", unit: "+1 court", ebitdaImpact: deltas.numberOfCourts.ebitdaImpact });
  }
  // Hours
  if (deltas.openingHoursPerDay) {
    consolidated.push({ label: "Hours/Day", unit: "+1 hour/day", ebitdaImpact: deltas.openingHoursPerDay.ebitdaImpact });
  }
  return consolidated.sort((a, b) => Math.abs(b.ebitdaImpact) - Math.abs(a.ebitdaImpact)).slice(0, 3);
}

// ─── Recommended actions ─────────────────────────────────────
export function generateRecommendedActions(
  kpis: KPIResult, inputs: ProjectInputs,
  deltas: Record<string, DriverDelta>, confidence: ModelConfidence
): string[] {
  const actions: string[] = [];
  const marginVal = isSafeValid(kpis.ebitdaMargin) ? kpis.ebitdaMargin.value! : null;

  // Compare occupancy vs price impact
  const occImpact = ((deltas.peakOccupancy?.ebitdaImpact || 0) + (deltas.offPeakOccupancy?.ebitdaImpact || 0)) / 2;
  const priceImpact = ((deltas.peakPrice?.ebitdaImpact || 0) + (deltas.offPeakPrice?.ebitdaImpact || 0)) / 2;

  if (Math.abs(occImpact) > Math.abs(priceImpact) * 1.2) {
    actions.push(`Increase occupancy before raising prices — it has the largest EBITDA impact (+€${Math.abs(occImpact / 1000).toFixed(0)}K per +5 pp)`);
  } else if (Math.abs(priceImpact) > Math.abs(occImpact) * 1.2) {
    actions.push(`Raise pricing before filling more slots — price changes drive more EBITDA (+€${Math.abs(priceImpact / 1000).toFixed(0)}K per +€5/h)`);
  } else {
    actions.push("Pursue both occupancy and pricing improvements — they yield similar EBITDA returns");
  }

  if (marginVal !== null && marginVal > 55) {
    actions.push("Validate cost assumptions — margins exceed industry benchmarks (>55%)");
  } else if (marginVal !== null && marginVal < 15) {
    actions.push("Reduce operating costs — thin margins leave no buffer for unexpected expenses");
  }

  if (confidence.level === "low") {
    actions.push("Refine inputs to improve model reliability — most values are still at defaults");
  } else if (confidence.level === "medium") {
    actions.push("Switch to detailed cost mode for higher accuracy on cost projections");
  }

  if (isSafeValid(kpis.breakEvenOccupancy)) {
    const buffer = kpis.weightedOccupancy - kpis.breakEvenOccupancy.value!;
    if (buffer < 5) {
      actions.push("Build more break-even margin — current occupancy is dangerously close to break-even");
    }
  }

  return actions.slice(0, 3);
}

// ─── Sensitivity ranking ─────────────────────────────────────
export interface SensitivityRank { key: string; label: string; ebitdaImpact: number; }

export function calculateSensitivityRanking(inputs: ProjectInputs, scenario: Scenario): SensitivityRank[] {
  const deltas = calculateDriverDeltas(inputs, scenario);
  return Object.values(deltas)
    .map((d) => ({ key: d.key, label: d.label, ebitdaImpact: Math.abs(d.ebitdaImpact) }))
    .sort((a, b) => b.ebitdaImpact - a.ebitdaImpact)
    .slice(0, 3);
}

// ─── Structured insights ─────────────────────────────────────
export interface StructuredInsight {
  profitDrivers: string;
  bestAction: string;
  mainRisk: string;
}

export function generateStructuredInsight(kpis: KPIResult, inputs: ProjectInputs, deltas?: Record<string, DriverDelta>): StructuredInsight {
  const marginVal = isSafeValid(kpis.ebitdaMargin) ? kpis.ebitdaMargin.value! : null;

  // Profit drivers
  let profitDrivers = "Profitability is driven by court occupancy and pricing.";
  if (deltas) {
    const sorted = Object.values(deltas).sort((a, b) => Math.abs(b.ebitdaImpact) - Math.abs(a.ebitdaImpact));
    if (sorted.length >= 2) {
      profitDrivers = `${sorted[0].label} and ${sorted[1].label} are the strongest profit drivers.`;
    } else if (sorted.length === 1) {
      profitDrivers = `${sorted[0].label} is the dominant profit driver.`;
    }
  }

  // Best action
  let bestAction = "Adjust key drivers to explore improvement scenarios.";
  if (deltas) {
    const occDelta = deltas.peakOccupancy;
    const priceDelta = deltas.peakPrice;
    if (occDelta && priceDelta) {
      if (Math.abs(occDelta.ebitdaImpact) > Math.abs(priceDelta.ebitdaImpact) * 1.2) {
        bestAction = `Focus on increasing occupancy — it improves EBITDA by €${Math.abs(occDelta.ebitdaImpact / 1000).toFixed(0)}K more than pricing.`;
      } else if (Math.abs(priceDelta.ebitdaImpact) > Math.abs(occDelta.ebitdaImpact) * 1.2) {
        bestAction = `Raising peak pricing has a stronger EBITDA effect than filling more slots.`;
      } else {
        bestAction = `Both occupancy and pricing improvements yield similar returns — pursue both.`;
      }
    }
  }

  // Main risk
  let mainRisk = "No significant risks detected at current assumptions.";
  if (marginVal !== null && marginVal > 55) {
    if (inputs.costMode === "basic" && inputs.staffCosts < inputs.monthlyOperatingCosts * 0.4) {
      mainRisk = "Margins are unusually high due to low staffing assumptions.";
    } else {
      mainRisk = "Margins exceed typical benchmarks — cost assumptions may be too optimistic.";
    }
  } else if (marginVal !== null && marginVal < 15) {
    mainRisk = "Thin margins leave little room for unexpected costs.";
  } else if (isSafeValid(kpis.paybackYears) && kpis.paybackYears.value! < 1) {
    mainRisk = "Sub-1-year payback is extremely aggressive — verify all inputs.";
  } else if (kpis.totalRevenueYear > 0 && kpis.annualCourtRevenue / kpis.totalRevenueYear > 0.85) {
    mainRisk = "Revenue is concentrated in court rental — consider diversifying.";
  } else if (inputs.costMode === "basic") {
    mainRisk = "Basic cost mode may underestimate real operating expenses.";
  }

  return { profitDrivers, bestAction, mainRisk };
}

// Legacy string insight for export
export function generateInsight(kpis: KPIResult, inputs: ProjectInputs, deltas?: Record<string, DriverDelta>): string {
  const s = generateStructuredInsight(kpis, inputs, deltas);
  return `${s.profitDrivers} ${s.bestAction} ${s.mainRisk}`;
}

// ─── Investment verdict ──────────────────────────────────────
export type VerdictLevel = "strong" | "moderate" | "weak" | "incomplete";

export interface InvestmentVerdict {
  level: VerdictLevel;
  label: string;
  explanation: string;
}

export function getInvestmentVerdict(kpis: KPIResult): InvestmentVerdict & { metrics: { payback: string; margin: string; roi: string }; interpretation: string } {
  const marginVal = isSafeValid(kpis.ebitdaMargin) ? kpis.ebitdaMargin.value! : null;
  const paybackVal = isSafeValid(kpis.paybackYears) ? kpis.paybackYears.value! : null;
  const roiVal = isSafeValid(kpis.roi) ? kpis.roi.value! : null;

  const metrics = {
    payback: paybackVal !== null ? `${paybackVal.toFixed(1)} yrs` : "—",
    margin: marginVal !== null ? `${marginVal.toFixed(0)}%` : "—",
    roi: roiVal !== null ? `${roiVal.toFixed(0)}%` : "—",
  };

  if (paybackVal === null || marginVal === null) {
    return { level: "incomplete", label: "Incomplete", explanation: "Complete inputs to assess investment attractiveness", metrics, interpretation: "Add pricing and cost inputs to get a verdict." };
  }

  if (paybackVal <= 3 && marginVal > 25) {
    const interp = marginVal > 55
      ? "Strong profitability with fast capital recovery, but margins may be optimistic."
      : "Strong economics with healthy margins and fast payback.";
    return { level: "strong", label: "Strong Investment", explanation: `Payback in ${paybackVal.toFixed(1)} years with ${marginVal.toFixed(0)}% margin`, metrics, interpretation: interp };
  }
  if (paybackVal <= 5) {
    return { level: "moderate", label: "Moderate", explanation: `Payback in ${paybackVal.toFixed(1)} years — solid but not exceptional`, metrics, interpretation: "Viable investment with room to optimize key drivers." };
  }
  return { level: "weak", label: "High Risk", explanation: `${paybackVal.toFixed(1)}-year payback suggests challenging economics`, metrics, interpretation: "Economics are stretched — reduce costs or boost revenue levers." };
}

// ─── Model confidence ────────────────────────────────────────
export type ConfidenceLevel = "high" | "medium" | "low";

export interface ModelConfidence {
  level: ConfidenceLevel;
  score: number; // 0-100
  reasons: string[];
}

export function getModelConfidence(inputs: ProjectInputs): ModelConfidence {
  let score = 0;
  const reasons: string[] = [];

  // Check if key inputs differ from defaults
  const checks: { key: keyof ProjectInputs; label: string; weight: number }[] = [
    { key: "initialInvestment", label: "Investment", weight: 15 },
    { key: "numberOfCourts", label: "Courts", weight: 10 },
    { key: "peakPrice", label: "Peak pricing", weight: 10 },
    { key: "offPeakPrice", label: "Off-peak pricing", weight: 10 },
    { key: "peakOccupancy", label: "Peak occupancy", weight: 10 },
    { key: "offPeakOccupancy", label: "Off-peak occupancy", weight: 10 },
    { key: "rentOrMortgage", label: "Rent/mortgage", weight: 10 },
    { key: "staffCosts", label: "Staff costs", weight: 10 },
  ];

  for (const c of checks) {
    if (inputs[c.key] !== DEFAULT_INPUTS[c.key]) {
      score += c.weight;
    }
  }

  // Detailed cost mode adds confidence
  if (inputs.costMode === "detailed") {
    score += 15;
  } else {
    reasons.push("Using basic cost mode");
  }

  // Check if still on all defaults
  const defaultCount = checks.filter(c => inputs[c.key] === DEFAULT_INPUTS[c.key]).length;
  if (defaultCount >= 6) reasons.push("Most inputs still at defaults");
  if (defaultCount >= 4 && defaultCount < 6) reasons.push("Some inputs at defaults");

  const level: ConfidenceLevel = score >= 65 ? "high" : score >= 35 ? "medium" : "low";
  return { level, score: Math.min(100, score), reasons };
}

// ─── Scenario comparison ─────────────────────────────────────
export interface ScenarioDelta { ebitdaPctChange: number | null; paybackDelta: number | null; revenuePctChange: number | null; }

export function calculateScenarioDelta(inputs: ProjectInputs, scenario: Scenario): ScenarioDelta | null {
  if (scenario === "base") return null;
  const base = calculateKPIs(inputs, "base");
  const current = calculateKPIs(inputs, scenario);
  return {
    ebitdaPctChange: base.ebitdaYear !== 0 ? ((current.ebitdaYear - base.ebitdaYear) / Math.abs(base.ebitdaYear)) * 100 : null,
    paybackDelta: isSafeValid(current.paybackYears) && isSafeValid(base.paybackYears) ? current.paybackYears.value! - base.paybackYears.value! : null,
    revenuePctChange: base.totalRevenueYear !== 0 ? ((current.totalRevenueYear - base.totalRevenueYear) / Math.abs(base.totalRevenueYear)) * 100 : null,
  };
}

export interface ScenarioComparison {
  base: KPIResult; current: KPIResult;
  revenueDelta: number; ebitdaDelta: number; paybackDelta: number | null; roiDelta: number | null;
}

export function calculateScenarioComparison(inputs: ProjectInputs, scenario: Scenario): ScenarioComparison {
  const base = calculateKPIs(inputs, "base");
  const current = calculateKPIs(inputs, scenario);
  return {
    base, current,
    revenueDelta: current.totalRevenueYear - base.totalRevenueYear,
    ebitdaDelta: current.ebitdaYear - base.ebitdaYear,
    paybackDelta: isSafeValid(current.paybackYears) && isSafeValid(base.paybackYears) ? current.paybackYears.value! - base.paybackYears.value! : null,
    roiDelta: isSafeValid(current.roi) && isSafeValid(base.roi) ? current.roi.value! - base.roi.value! : null,
  };
}

// ─── Formatting helpers ──────────────────────────────────────
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
export interface ValidationWarning { id: string; message: string; severity: "warning" | "error"; }

export function getValidationWarnings(kpis: KPIResult): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const marginVal = isSafeValid(kpis.ebitdaMargin) ? kpis.ebitdaMargin.value! : null;
  if (marginVal !== null && marginVal > 55) warnings.push({ id: "high-margin", message: "Unusually high margin — check cost assumptions", severity: "warning" });
  if (isSafeValid(kpis.paybackYears) && kpis.paybackYears.value! < 1) warnings.push({ id: "fast-payback", message: "Unrealistic payback — verify inputs", severity: "error" });
  return warnings;
}

// ─── Loan payment ────────────────────────────────────────────
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
  const normalized = normalizeProjectInputs(inputs);
  const m = SCENARIO_MULTIPLIERS[scenario];
  const courts = safe(normalized.numberOfCourts);
  const hoursPerDay = safe(normalized.openingHoursPerDay);
  const peakOccInput = safe(normalized.peakOccupancy);
  const offPeakOccInput = safe(normalized.offPeakOccupancy);
  const peakPriceInput = safe(normalized.peakPrice);
  const offPeakPriceInput = safe(normalized.offPeakPrice);
  const investment = safe(normalized.initialInvestment) * m.capexMultiplier;
  const debtPct = safe(normalized.debtPercentage);
  const intRate = safe(normalized.interestRate);
  const loanTerm = safe(normalized.loanTermYears);

  const peakOcc = Math.min(100, Math.max(0, peakOccInput + m.occupancyOffset)) / 100;
  const offPeakOcc = Math.min(100, Math.max(0, offPeakOccInput + m.occupancyOffset)) / 100;
  const peakPrice = peakPriceInput * m.pricingMultiplier;
  const offPeakPrice = offPeakPriceInput * m.pricingMultiplier;

  const totalHoursMonth = courts * hoursPerDay * DAYS_PER_MONTH;
  const peakHoursMonth = totalHoursMonth * PEAK_RATIO;
  const offPeakHoursMonth = totalHoursMonth * OFFPEAK_RATIO;

  const weightedOccPctBase = Math.min(100, Math.max(0, (peakOccInput * PEAK_RATIO) + (offPeakOccInput * OFFPEAK_RATIO)));
  const totalAvailableHoursMonth = totalHoursMonth;
  const maxCoachingHoursPerDay = Math.max(0, courts * hoursPerDay * (1 - (weightedOccPctBase / 100)));
  const coachingHoursPerDay = normalized.coachingEnabled
    ? Math.min(Math.max(0, safe(normalized.coachingHoursPerDay)), maxCoachingHoursPerDay)
    : 0;
  const coachingHoursMonth = coachingHoursPerDay * (safe(normalized.operatingDaysPerYear) / MONTHS_PER_YEAR);
  const coachingHoursPct = totalAvailableHoursMonth > 0
    ? (coachingHoursMonth / totalAvailableHoursMonth) * 100
    : 0;
  const bookingAvailableHoursMonth = Math.max(0, totalAvailableHoursMonth - coachingHoursMonth);
  const bookingPct = totalAvailableHoursMonth > 0 ? (bookingAvailableHoursMonth / totalAvailableHoursMonth) * 100 : 0;
  const capacityWarning = coachingHoursMonth > totalAvailableHoursMonth + 0.001;

  const peakBookingHours = bookingAvailableHoursMonth * PEAK_RATIO;
  const offPeakBookingHours = bookingAvailableHoursMonth * OFFPEAK_RATIO;
  const courtRevenueMonth = safe(peakBookingHours * peakOcc * peakPrice) + safe(offPeakBookingHours * offPeakOcc * offPeakPrice);
  const bookedHoursMonth = (peakBookingHours * peakOcc) + (offPeakBookingHours * offPeakOcc);

  const coachingRevenueMonth = normalized.coachingEnabled
    ? coachingHoursMonth * safe(normalized.coachingPricePerHour)
    : 0;
  const coachingCostMonth = coachingRevenueMonth * (safe(normalized.coachingCostShare) / 100);
  const coachingNetMonth = coachingRevenueMonth - coachingCostMonth;

  const tournamentsRevenueMonth = normalized.tournamentsEnabled
    ? safe(normalized.tournamentsPerMonth) * safe(normalized.tournamentRevenuePerEvent)
    : 0;
  const tournamentsCostMonth = normalized.tournamentsEnabled
    ? safe(normalized.tournamentsPerMonth) * safe(normalized.tournamentCostPerEvent)
    : 0;
  const tournamentsNetMonth = tournamentsRevenueMonth - tournamentsCostMonth;

  const eventsRevenueMonth = normalized.eventsEnabled
    ? safe(normalized.eventsPerMonth) * safe(normalized.eventRevenuePerEvent)
    : 0;
  const eventsCostMonth = normalized.eventsEnabled
    ? safe(normalized.eventsPerMonth) * safe(normalized.eventCostPerEvent)
    : 0;
  const eventsNetMonth = eventsRevenueMonth - eventsCostMonth;

  const otherRevenueMonth = normalized.otherRevenueEnabled
    ? normalized.otherRevenueItems.reduce((sum, item) => sum + safe(item.monthlyRevenue), 0)
    : 0;
  const otherCostMonth = normalized.otherRevenueEnabled
    ? normalized.otherRevenueItems.reduce((sum, item) => sum + safe(item.monthlyCost), 0)
    : 0;
  const otherNetMonth = otherRevenueMonth - otherCostMonth;

  const totalRevenueMonth = courtRevenueMonth + coachingRevenueMonth + tournamentsRevenueMonth + eventsRevenueMonth + otherRevenueMonth;
  const totalRevenueYear = totalRevenueMonth * MONTHS_PER_YEAR;

  const addOnEbitdaMonth = coachingNetMonth + tournamentsNetMonth + eventsNetMonth + otherNetMonth;

  // ─── Court direct costs (variable cost per booked hour) ───
  const courtDirectCostMonth = safe(normalized.variableCostPerHour) * bookedHoursMonth;

  // ─── Indirect costs (facility-wide) and per-line allocation ───
  const costBreakdown = calculateCostBreakdown(normalized, totalHoursMonth, bookedHoursMonth);
  const indirectCostsMonth = costBreakdown.totalCosts * m.costMultiplier;

  // Revenue shares for proportional allocation
  const courtShare = totalRevenueMonth > 0 ? courtRevenueMonth / totalRevenueMonth : 0;
  const coachingShare = totalRevenueMonth > 0 ? coachingRevenueMonth / totalRevenueMonth : 0;
  const tournamentsShare = totalRevenueMonth > 0 ? tournamentsRevenueMonth / totalRevenueMonth : 0;
  const eventsShare = totalRevenueMonth > 0 ? eventsRevenueMonth / totalRevenueMonth : 0;
  const otherShare = totalRevenueMonth > 0 ? otherRevenueMonth / totalRevenueMonth : 0;

  // Allocated indirect costs per line (monthly)
  const courtIndirectMonth = indirectCostsMonth * courtShare;
  const coachingIndirectMonth = indirectCostsMonth * coachingShare;
  const tournamentsIndirectMonth = indirectCostsMonth * tournamentsShare;
  const eventsIndirectMonth = indirectCostsMonth * eventsShare;
  const otherIndirectMonth = indirectCostsMonth * otherShare;

  // Per-line EBITDA (monthly)
  const courtEbitdaMonth = courtRevenueMonth - courtDirectCostMonth - courtIndirectMonth;
  const coachingEbitdaMonth = coachingRevenueMonth - coachingCostMonth - coachingIndirectMonth;
  const tournamentsEbitdaMonth = tournamentsRevenueMonth - tournamentsCostMonth - tournamentsIndirectMonth;
  const eventsEbitdaMonth = eventsRevenueMonth - eventsCostMonth - eventsIndirectMonth;
  const otherEbitdaMonth = otherRevenueMonth - otherCostMonth - otherIndirectMonth;

  // Annualize
  const Y = MONTHS_PER_YEAR;
  const courtDirectCostYear = courtDirectCostMonth * Y;
  const totalDirectCostsYear = (courtDirectCostMonth + coachingCostMonth + tournamentsCostMonth + eventsCostMonth + otherCostMonth) * Y;
  const totalIndirectCostsYear = indirectCostsMonth * Y;

  const revenueBreakdown: RevenueBreakdown = {
    courtRevenue: courtRevenueMonth * Y,
    courtDirectCost: courtDirectCostYear,
    courtAllocatedIndirect: courtIndirectMonth * Y,
    courtEbitda: courtEbitdaMonth * Y,
    courtEbitdaMargin: courtRevenueMonth > 0 ? (courtEbitdaMonth / courtRevenueMonth) * 100 : 0,

    coachingRevenue: coachingRevenueMonth * Y,
    coachingCost: coachingCostMonth * Y,
    coachingNet: coachingNetMonth * Y,
    coachingAllocatedIndirect: coachingIndirectMonth * Y,
    coachingEbitda: coachingEbitdaMonth * Y,
    coachingEbitdaMargin: coachingRevenueMonth > 0 ? (coachingEbitdaMonth / coachingRevenueMonth) * 100 : 0,

    tournamentsRevenue: tournamentsRevenueMonth * Y,
    tournamentsCost: tournamentsCostMonth * Y,
    tournamentsNet: tournamentsNetMonth * Y,
    tournamentsAllocatedIndirect: tournamentsIndirectMonth * Y,
    tournamentsEbitda: tournamentsEbitdaMonth * Y,
    tournamentsEbitdaMargin: tournamentsRevenueMonth > 0 ? (tournamentsEbitdaMonth / tournamentsRevenueMonth) * 100 : 0,

    eventsRevenue: eventsRevenueMonth * Y,
    eventsCost: eventsCostMonth * Y,
    eventsNet: eventsNetMonth * Y,
    eventsAllocatedIndirect: eventsIndirectMonth * Y,
    eventsEbitda: eventsEbitdaMonth * Y,
    eventsEbitdaMargin: eventsRevenueMonth > 0 ? (eventsEbitdaMonth / eventsRevenueMonth) * 100 : 0,

    tournamentRevenue: tournamentsRevenueMonth * Y,
    tournamentCost: tournamentsCostMonth * Y,
    tournamentNet: tournamentsNetMonth * Y,

    otherRevenue: otherRevenueMonth * Y,
    otherCost: otherCostMonth * Y,
    otherNet: otherNetMonth * Y,
    otherAllocatedIndirect: otherIndirectMonth * Y,
    otherEbitda: otherEbitdaMonth * Y,
    otherEbitdaMargin: otherRevenueMonth > 0 ? (otherEbitdaMonth / otherRevenueMonth) * 100 : 0,

    totalRevenue: totalRevenueYear,
    totalDirectCosts: totalDirectCostsYear,
    totalIndirectCosts: totalIndirectCostsYear,
    totalEbitda: 0,
    addOnEbitda: addOnEbitdaMonth * Y,
    addOnPct: 0,
    bookingHoursPct: bookingPct,
    coachingHoursPct,
    capacityWarning,
  };

  const totalAllCostsMonth = indirectCostsMonth + courtDirectCostMonth + coachingCostMonth + tournamentsCostMonth + eventsCostMonth + otherCostMonth;

  const ebitdaMonth = totalRevenueMonth - totalAllCostsMonth;
  const ebitdaYear = ebitdaMonth * MONTHS_PER_YEAR;
  const ebitdaMarginRaw = safeDiv(ebitdaMonth, totalRevenueMonth);
  const ebitdaMargin = makeSafeMetric(ebitdaMarginRaw !== null ? ebitdaMarginRaw * 100 : null, totalRevenueMonth > 0);

  // Update revenue breakdown with final EBITDA figures
  revenueBreakdown.totalEbitda = ebitdaYear;
  revenueBreakdown.addOnPct = ebitdaYear !== 0
    ? (revenueBreakdown.addOnEbitda / Math.abs(ebitdaYear)) * 100
    : 0;

  const loanAmount = investment * (debtPct / 100);
  const loanPaymentMonth = calcMonthlyLoanPayment(loanAmount, intRate, loanTerm);
  const netCashflowMonth = ebitdaMonth - safe(loanPaymentMonth);
  const netCashflowYear = netCashflowMonth * MONTHS_PER_YEAR;

  const roiRaw = safeDiv(ebitdaYear, investment);
  const roi = makeSafeMetric(roiRaw !== null ? roiRaw * 100 : null, investment > 0);
  const paybackRaw = ebitdaYear > 0 ? safeDiv(investment, ebitdaYear) : null;
  const paybackYears = makeSafeMetric(paybackRaw, ebitdaYear > 0);

  // Break-even occupancy: minimum occupancy where Year 1 revenue covers
  // the full initial investment (CAPEX) plus all operating costs (OPEX).
  // Since EBITDA = Revenue − OPEX, the condition Revenue ≥ CAPEX + OPEX
  // simplifies to EBITDA ≥ CAPEX. The target is a fixed number (investment)
  // so it does not shift when occupancy inputs change.
  const breakEvenOccupancy = (() => {
    if (courts <= 0 || hoursPerDay <= 0) return makeSafeMetric(null, false);
    const target = investment;

    // Compute annual EBITDA at a given UNIFORM occupancy %
    const ebitdaAtOcc = (occPct: number): number => {
      const occ = occPct / 100;
      const courtRevMonth = (bookingAvailableHoursMonth * PEAK_RATIO * occ * peakPrice) +
                            (bookingAvailableHoursMonth * OFFPEAK_RATIO * occ * offPeakPrice);
      const totalRevMonth = courtRevMonth + coachingRevenueMonth + tournamentsRevenueMonth + eventsRevenueMonth + otherRevenueMonth;
      const bookedHrs = bookingAvailableHoursMonth * occ;
      const cb = calculateCostBreakdown(normalized, totalHoursMonth, bookedHrs);
      const directAddon = coachingCostMonth + tournamentsCostMonth + eventsCostMonth + otherCostMonth;
      const courtDirect = safe(normalized.variableCostPerHour) * bookedHrs;
      const monthlyEbitda = totalRevMonth - (cb.totalCosts * m.costMultiplier) - directAddon - courtDirect;
      return monthlyEbitda * MONTHS_PER_YEAR;
    };

    let lo = 0, hi = 100;

    if (ebitdaAtOcc(100) < target) return makeSafeMetric(100, true);
    if (ebitdaAtOcc(0) >= target) return makeSafeMetric(0, true);

    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      if (ebitdaAtOcc(mid) >= target) {
        hi = mid;
      } else {
        lo = mid;
      }
    }
    const result = Math.round((lo + hi) / 2 * 10) / 10;
    return makeSafeMetric(Math.max(0, Math.min(100, result)), true);
  })();

  const weightedOccupancy = Math.min(100, Math.max(0, (peakOccInput * PEAK_RATIO + offPeakOccInput * OFFPEAK_RATIO) + m.occupancyOffset));

  // ── Investor / financing metrics ──
  const equityInvested = investment - safe(loanAmount);
  const annualDebtPayment = safe(loanPaymentMonth) * MONTHS_PER_YEAR;
  const totalInterestPaid = loanTerm > 0 ? (annualDebtPayment * loanTerm) - safe(loanAmount) : 0;
  const cashFlowToEquity = ebitdaYear - annualDebtPayment;
  const roiOnEquityRaw = safeDiv(cashFlowToEquity, equityInvested);
  const roiOnEquity = makeSafeMetric(roiOnEquityRaw !== null ? roiOnEquityRaw * 100 : null, equityInvested > 0);
  const paybackEquityRaw = cashFlowToEquity > 0 ? safeDiv(equityInvested, cashFlowToEquity) : null;
  const paybackEquity = makeSafeMetric(paybackEquityRaw, cashFlowToEquity > 0 && equityInvested > 0);

  return {
    totalInvestment: investment, totalHoursMonth, peakHoursMonth, offPeakHoursMonth,
    courtRevenueMonth, otherRevenueMonth, totalRevenueMonth,
    ebitdaMonth, loanPaymentMonth: safe(loanPaymentMonth), netCashflowMonth,
    totalRevenueYear, ebitdaYear, netCashflowYear,
    ebitdaMargin, roi, paybackYears, breakEvenOccupancy, weightedOccupancy,
    loanAmount: safe(loanAmount),
    annualCourtRevenue: courtRevenueMonth * MONTHS_PER_YEAR,
    annualOtherRevenue: (coachingRevenueMonth + tournamentsRevenueMonth + eventsRevenueMonth + otherRevenueMonth) * MONTHS_PER_YEAR,
    annualCosts: totalAllCostsMonth * MONTHS_PER_YEAR,
    costBreakdown,
    revenueBreakdown,
    equityInvested, annualDebtPayment, totalInterestPaid, cashFlowToEquity,
    roiOnEquity, paybackEquity,
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

// ─── 5-Year Projection ──────────────────────────────────────
export interface YearProjection {
  year: string;
  revenue: number;
  ebitda: number;
}

export function calculate5YearProjection(inputs: ProjectInputs, scenario: Scenario, annualGrowthRate = 5): YearProjection[] {
  const kpis = calculateKPIs(inputs, scenario);
  const projections: YearProjection[] = [];
  for (let y = 0; y < 5; y++) {
    const growthFactor = Math.pow(1 + annualGrowthRate / 100, y);
    const revenue = Math.round(kpis.totalRevenueYear * growthFactor);
    const costs = Math.round(kpis.annualCosts * Math.pow(1 + (annualGrowthRate * 0.3) / 100, y));
    const ebitda = revenue - costs;
    projections.push({ year: `Year ${y + 1}`, revenue, ebitda });
  }
  return projections;
}

// ─── Cumulative payback (year-by-year) ───────────────────────
export function calculatePaybackCumulative(inputs: ProjectInputs, scenario: Scenario, annualGrowthRate = 5): number | null {
  const investment = safe(inputs.initialInvestment);
  if (investment <= 0) return null;
  const projection = calculate5YearProjection(inputs, scenario, annualGrowthRate);
  let cumCashflow = 0;
  for (let i = 0; i < projection.length; i++) {
    cumCashflow += projection[i].ebitda;
    if (cumCashflow >= investment) {
      const prevCum = cumCashflow - projection[i].ebitda;
      const remaining = investment - prevCum;
      const fraction = projection[i].ebitda > 0 ? remaining / projection[i].ebitda : 1;
      return i + fraction;
    }
  }
  return null;
}

// ─── Cumulative ROI ──────────────────────────────────────────
export function calculateCumulativeROI(inputs: ProjectInputs, scenario: Scenario, years: number, annualGrowthRate = 5): number | null {
  const investment = safe(inputs.initialInvestment);
  if (investment <= 0) return null;
  const projection = calculate5YearProjection(inputs, scenario, annualGrowthRate);
  let cumEbitda = 0;
  for (let i = 0; i < Math.min(years, projection.length); i++) {
    cumEbitda += projection[i].ebitda;
  }
  return (cumEbitda / investment) * 100;
}

// ─── Highlights generation ───────────────────────────────────
export function generateHighlights(kpis: KPIResult, inputs: ProjectInputs): string[] {
  const highlights: string[] = [];
  const marginVal = isSafeValid(kpis.ebitdaMargin) ? kpis.ebitdaMargin.value! : null;
  const paybackVal = isSafeValid(kpis.paybackYears) ? kpis.paybackYears.value! : null;

  highlights.push("Growing padel market with increasing demand across Europe");

  if (marginVal !== null && marginVal > 30) {
    highlights.push(`High EBITDA margin (${marginVal.toFixed(0)}%) indicates strong profitability`);
  } else if (marginVal !== null && marginVal > 15) {
    highlights.push(`Solid EBITDA margin of ${marginVal.toFixed(0)}% with room to optimize`);
  }

  if (paybackVal !== null && paybackVal <= 3) {
    highlights.push("Fast payback reduces investment risk significantly");
  } else if (paybackVal !== null && paybackVal <= 5) {
    highlights.push("Payback within 5 years — acceptable for facility investments");
  }

  if (kpis.totalRevenueYear > 0) {
    const courtShare = kpis.annualCourtRevenue / kpis.totalRevenueYear;
    if (courtShare < 0.80) {
      highlights.push("Revenue structure is well diversified across multiple streams");
    } else {
      highlights.push("Multiple revenue streams available (courts, coaching, events, bar)");
    }
  }

  if (inputs.numberOfCourts >= 6) {
    highlights.push("Scale advantages with larger facility — lower per-court operating costs");
  }

  return highlights.slice(0, 5);
}

// ─── Export data shape ───────────────────────────────────────
export interface ExportData {
  projectName: string;
  location: string;
  versionName: string;
  scenario: Scenario;
  date: string;
  kpis: KPIResult;
  verdict: InvestmentVerdict;
  confidence: ModelConfidence;
  insight: string;
  sensitivity: SensitivityRank[];
  inputs: ProjectInputs;
  currency?: string;
}

// ─── EBITDA Sensitivity Matrix ───────────────────────────────
export interface SensitivityMatrixCell {
  occupancy: number;
  price: number;
  ebitda: number;
  isBase: boolean;
}

export interface SensitivityMatrix {
  occupancyLevels: number[];
  priceLevels: number[];
  cells: SensitivityMatrixCell[][];
  minEbitda: number;
  maxEbitda: number;
}

export function calculateSensitivityMatrix(inputs: ProjectInputs, scenario: Scenario): SensitivityMatrix {
  const occupancyLevels = [10, 20, 30, 40, 50, 60, 70, 80, 90];
  const priceLevels = [20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];

  // Base-case highlight: closest cell to current weighted average price & occupancy
  const weightedAvgPrice = Math.round(
    safe(inputs.peakPrice) * PEAK_RATIO + safe(inputs.offPeakPrice) * OFFPEAK_RATIO
  );
  const weightedAvgOcc = Math.round(
    safe(inputs.peakOccupancy) * PEAK_RATIO + safe(inputs.offPeakOccupancy) * OFFPEAK_RATIO
  );
  const closestOccIdx = occupancyLevels.reduce((bestIdx, level, idx) =>
    Math.abs(level - weightedAvgOcc) < Math.abs(occupancyLevels[bestIdx] - weightedAvgOcc) ? idx : bestIdx, 0);
  const closestPriceIdx = priceLevels.reduce((bestIdx, level, idx) =>
    Math.abs(level - weightedAvgPrice) < Math.abs(priceLevels[bestIdx] - weightedAvgPrice) ? idx : bestIdx, 0);

  let minEbitda = Infinity;
  let maxEbitda = -Infinity;

  const cells: SensitivityMatrixCell[][] = occupancyLevels.map((occ, ri) => {
    return priceLevels.map((price, ci) => {
      // Uniform price & occupancy: no peak/off-peak split
      const tweaked: ProjectInputs = {
        ...inputs,
        peakOccupancy: occ,
        offPeakOccupancy: occ,
        peakPrice: price,
        offPeakPrice: price,
      };
      const result = calculateKPIs(tweaked, scenario);
      const ebitda = result.ebitdaYear;
      if (ebitda < minEbitda) minEbitda = ebitda;
      if (ebitda > maxEbitda) maxEbitda = ebitda;

      const isBase = ri === closestOccIdx && ci === closestPriceIdx;
      return { occupancy: occ, price, ebitda, isBase };
    });
  });

  return { occupancyLevels, priceLevels, cells, minEbitda, maxEbitda };
}
