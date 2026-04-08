import { ProjectInputs, Scenario, SCENARIO_MULTIPLIERS, DEFAULT_INPUTS } from "./types";

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
  coachingRevenue: number;
  coachingCost: number;
  coachingNet: number;
  tournamentRevenue: number;
  tournamentCost: number;
  tournamentNet: number;
  otherRevenue: number;
  otherCost: number;
  otherNet: number;
  totalRevenue: number;
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
  const m = SCENARIO_MULTIPLIERS[scenario];
  const courts = safe(inputs.numberOfCourts);
  const hoursPerDay = safe(inputs.openingHoursPerDay);
  const peakOccInput = safe(inputs.peakOccupancy);
  const offPeakOccInput = safe(inputs.offPeakOccupancy);
  const peakPriceInput = safe(inputs.peakPrice);
  const offPeakPriceInput = safe(inputs.offPeakPrice);
  const investment = safe(inputs.initialInvestment) * m.capexMultiplier;
  const debtPct = safe(inputs.debtPercentage);
  const intRate = safe(inputs.interestRate);
  const loanTerm = safe(inputs.loanTermYears);

  const peakOcc = Math.min(100, Math.max(0, peakOccInput + m.occupancyOffset)) / 100;
  const offPeakOcc = Math.min(100, Math.max(0, offPeakOccInput + m.occupancyOffset)) / 100;
  const peakPrice = peakPriceInput * m.pricingMultiplier;
  const offPeakPrice = offPeakPriceInput * m.pricingMultiplier;

  const totalHoursMonth = courts * hoursPerDay * DAYS_PER_MONTH;
  const peakHoursMonth = totalHoursMonth * PEAK_RATIO;
  const offPeakHoursMonth = totalHoursMonth * OFFPEAK_RATIO;

  const courtRevenueMonth = safe(peakHoursMonth * peakOcc * peakPrice) + safe(offPeakHoursMonth * offPeakOcc * offPeakPrice);

  // ── Modular Revenue Calculation ──
  const bookedHoursMonth = (peakHoursMonth * peakOcc) + (offPeakHoursMonth * offPeakOcc);

  // A. Coaching / Classes
  const coachingRevenueMonth = inputs.coachingEnabled
    ? bookedHoursMonth * (safe(inputs.coachingPctOfHours) / 100) * safe(inputs.coachingPricePerHour)
    : 0;
  const coachingCostMonth = coachingRevenueMonth * (safe(inputs.coachingCostShare) / 100);
  const coachingNetMonth = coachingRevenueMonth - coachingCostMonth;

  // B. Tournaments / Events
  const tournamentRevenueMonth = inputs.tournamentsEnabled
    ? safe(inputs.eventsPerMonth) * safe(inputs.avgRevenuePerEvent)
    : 0;
  const tournamentCostMonth = inputs.tournamentsEnabled
    ? safe(inputs.eventsPerMonth) * safe(inputs.avgCostPerEvent)
    : 0;
  const tournamentNetMonth = tournamentRevenueMonth - tournamentCostMonth;

  // C. Other Revenue
  const otherRevenueMonth = inputs.otherRevenueEnabled
    ? safe(inputs.proshopRevenue) + safe(inputs.fAndBRevenue) + safe(inputs.membershipFees)
    : 0;

  const totalRevenueMonth = courtRevenueMonth + coachingRevenueMonth + tournamentRevenueMonth + otherRevenueMonth;
  const totalRevenueYear = totalRevenueMonth * MONTHS_PER_YEAR;

  const revenueBreakdown: RevenueBreakdown = {
    courtRevenue: courtRevenueMonth * MONTHS_PER_YEAR,
    coachingRevenue: coachingRevenueMonth * MONTHS_PER_YEAR,
    coachingCost: coachingCostMonth * MONTHS_PER_YEAR,
    coachingNet: coachingNetMonth * MONTHS_PER_YEAR,
    tournamentRevenue: tournamentRevenueMonth * MONTHS_PER_YEAR,
    tournamentCost: tournamentCostMonth * MONTHS_PER_YEAR,
    tournamentNet: tournamentNetMonth * MONTHS_PER_YEAR,
    otherRevenue: otherRevenueMonth * MONTHS_PER_YEAR,
    totalRevenue: totalRevenueYear,
  };

  // Total costs to deduct includes coaching and tournament costs
  const additionalCosts = coachingCostMonth + tournamentCostMonth;
  const costBreakdown = calculateCostBreakdown(inputs, totalHoursMonth, bookedHoursMonth);
  // Apply scenario cost multiplier
  const monthlyCosts = (costBreakdown.totalCosts + additionalCosts) * m.costMultiplier;

  const ebitdaMonth = totalRevenueMonth - monthlyCosts;
  const ebitdaYear = ebitdaMonth * MONTHS_PER_YEAR;
  const ebitdaMarginRaw = safeDiv(ebitdaMonth, totalRevenueMonth);
  const ebitdaMargin = makeSafeMetric(ebitdaMarginRaw !== null ? ebitdaMarginRaw * 100 : null, totalRevenueMonth > 0);

  const loanAmount = investment * (debtPct / 100);
  const loanPaymentMonth = calcMonthlyLoanPayment(loanAmount, intRate, loanTerm);
  const netCashflowMonth = ebitdaMonth - safe(loanPaymentMonth);
  const netCashflowYear = netCashflowMonth * MONTHS_PER_YEAR;

  const roiRaw = safeDiv(ebitdaYear, investment);
  const roi = makeSafeMetric(roiRaw !== null ? roiRaw * 100 : null, investment > 0);
  const paybackRaw = ebitdaYear > 0 ? safeDiv(investment, ebitdaYear) : null;
  const paybackYears = makeSafeMetric(paybackRaw, ebitdaYear > 0);

  // Break-even occupancy: solve for occ where Revenue(occ) - OPEX(occ) = CAPEX + OPEX_year1
  // Using binary search since costs may have variable components
  const breakEvenOccupancy = (() => {
    if (courts <= 0 || hoursPerDay <= 0) return makeSafeMetric(null, false);
    const capex = investment;
    const opexYear1 = monthlyCosts * MONTHS_PER_YEAR;
    const target = capex + opexYear1; // what annual EBITDA must cover

    // Helper: compute annual EBITDA at a given uniform occupancy %
    const ebitdaAtOcc = (occPct: number): number => {
      const occ = occPct / 100;
      const courtRevMonth = (peakHoursMonth * occ * peakPrice) + (offPeakHoursMonth * occ * offPeakPrice);
      const totalRevMonth = courtRevMonth + otherRevenueMonth;
      // Recalculate costs at this occupancy (variable costs scale with booked hours)
      const bookedHrs = (peakHoursMonth * occ) + (offPeakHoursMonth * occ);
      const cb = calculateCostBreakdown(inputs, totalHoursMonth, bookedHrs);
      const monthlyEbitda = totalRevMonth - cb.totalCosts;
      return monthlyEbitda * MONTHS_PER_YEAR;
    };

    // Binary search between 0% and 100%
    let lo = 0, hi = 100;
    const ebitdaAt0 = ebitdaAtOcc(0);
    const ebitdaAt100 = ebitdaAtOcc(100);

    // If even at 100% we can't reach target, break-even is not achievable
    if (ebitdaAt100 < target) return makeSafeMetric(100, true);
    // If at 0% we already exceed target (due to other revenue), return 0
    if (ebitdaAt0 >= target) return makeSafeMetric(0, true);

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
    annualOtherRevenue: (coachingRevenueMonth + tournamentRevenueMonth + otherRevenueMonth) * MONTHS_PER_YEAR,
    annualCosts: monthlyCosts * MONTHS_PER_YEAR,
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
