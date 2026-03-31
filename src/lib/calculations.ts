import { ProjectInputs, Scenario, SCENARIO_MULTIPLIERS } from "./types";

// ─── Constants ───────────────────────────────────────────────
const DAYS_PER_MONTH = 30;
const MONTHS_PER_YEAR = 12;
const PEAK_RATIO = 0.4; // 40% of hours are peak
const OFFPEAK_RATIO = 0.6;

// ─── KPI result shape ────────────────────────────────────────
export interface KPIResult {
  // Investment
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

  // Ratios
  ebitdaMargin: number; // 0-1
  roi: number;          // percentage
  paybackYears: number;

  // Break-even
  breakEvenOccupancy: number; // 0-100
  weightedOccupancy: number;  // 0-100

  // Financing
  loanAmount: number;

  // For charts
  annualCourtRevenue: number;
  annualOtherRevenue: number;
  annualCosts: number;
}

// ─── Loan payment (standard amortisation formula) ────────────
function calcMonthlyLoanPayment(principal: number, annualRate: number, years: number): number {
  if (principal <= 0 || years <= 0) return 0;
  if (annualRate <= 0) return principal / (years * MONTHS_PER_YEAR);

  const r = annualRate / 100 / MONTHS_PER_YEAR;
  const n = years * MONTHS_PER_YEAR;
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

// ─── Main KPI calculation ────────────────────────────────────
export function calculateKPIs(inputs: ProjectInputs, scenario: Scenario): KPIResult {
  const m = SCENARIO_MULTIPLIERS[scenario];

  // Apply scenario adjustments
  const peakOcc = Math.min(100, Math.max(0, inputs.peakOccupancy + m.occupancyOffset)) / 100;
  const offPeakOcc = Math.min(100, Math.max(0, inputs.offPeakOccupancy + m.occupancyOffset)) / 100;
  const peakPrice = inputs.peakPrice * m.pricingMultiplier;
  const offPeakPrice = inputs.offPeakPrice * m.pricingMultiplier;

  // ── Step 1: Capacity ──
  const totalHoursMonth = inputs.numberOfCourts * inputs.openingHoursPerDay * DAYS_PER_MONTH;
  const peakHoursMonth = totalHoursMonth * PEAK_RATIO;
  const offPeakHoursMonth = totalHoursMonth * OFFPEAK_RATIO;

  // ── Step 2: Court revenue (monthly) ──
  const peakRevenue = peakHoursMonth * peakOcc * peakPrice;
  const offPeakRevenue = offPeakHoursMonth * offPeakOcc * offPeakPrice;
  const courtRevenueMonth = peakRevenue + offPeakRevenue;

  // ── Step 3: Total revenue ──
  const otherRevenueMonth = inputs.otherMonthlyRevenue + inputs.proshopRevenue + inputs.fAndBRevenue + inputs.membershipFees;
  const totalRevenueMonth = courtRevenueMonth + otherRevenueMonth;
  const totalRevenueYear = totalRevenueMonth * MONTHS_PER_YEAR;

  // ── Step 4: EBITDA ──
  const ebitdaMonth = totalRevenueMonth - inputs.monthlyOperatingCosts;
  const ebitdaYear = ebitdaMonth * MONTHS_PER_YEAR;
  const ebitdaMargin = totalRevenueMonth > 0 ? ebitdaMonth / totalRevenueMonth : 0;

  // ── Step 5: Financing ──
  const loanAmount = inputs.initialInvestment * (inputs.debtPercentage / 100);
  const loanPaymentMonth = calcMonthlyLoanPayment(loanAmount, inputs.interestRate, inputs.loanTermYears);

  // ── Step 6: Net cashflow ──
  const netCashflowMonth = ebitdaMonth - loanPaymentMonth;
  const netCashflowYear = netCashflowMonth * MONTHS_PER_YEAR;

  // ── Step 7: ROI ──
  const roi = inputs.initialInvestment > 0 ? (ebitdaYear / inputs.initialInvestment) * 100 : 0;

  // ── Step 8: Payback ──
  const paybackYears = ebitdaYear > 0 ? inputs.initialInvestment / ebitdaYear : Infinity;

  // ── Step 9: Break-even occupancy ──
  // Revenue at 100% occupancy (monthly)
  const courtRevenueAt100 = (peakHoursMonth * peakPrice) + (offPeakHoursMonth * offPeakPrice);
  const requiredRevenue = inputs.monthlyOperatingCosts + loanPaymentMonth;
  // required_revenue = break_even_ratio * courtRevenueAt100 + otherRevenueMonth
  // → break_even_ratio = (required_revenue - otherRevenueMonth) / courtRevenueAt100
  const breakEvenOccupancy = courtRevenueAt100 > 0
    ? Math.max(0, Math.min(100, ((requiredRevenue - otherRevenueMonth) / courtRevenueAt100) * 100))
    : 100;

  // Weighted current occupancy (blended peak/off-peak)
  const weightedOccupancy = (inputs.peakOccupancy * PEAK_RATIO + inputs.offPeakOccupancy * OFFPEAK_RATIO) + m.occupancyOffset;

  return {
    totalInvestment: inputs.initialInvestment,
    totalHoursMonth,
    peakHoursMonth,
    offPeakHoursMonth,
    courtRevenueMonth,
    otherRevenueMonth,
    totalRevenueMonth,
    ebitdaMonth,
    loanPaymentMonth,
    netCashflowMonth,
    totalRevenueYear,
    ebitdaYear,
    netCashflowYear,
    ebitdaMargin,
    roi,
    paybackYears,
    breakEvenOccupancy,
    weightedOccupancy: Math.min(100, Math.max(0, weightedOccupancy)),
    loanAmount,
    annualCourtRevenue: courtRevenueMonth * MONTHS_PER_YEAR,
    annualOtherRevenue: otherRevenueMonth * MONTHS_PER_YEAR,
    annualCosts: inputs.monthlyOperatingCosts * MONTHS_PER_YEAR,
  };
}

// ─── Monthly evolution (flat projection with seasonality) ────
export function getMonthlyEvolution(inputs: ProjectInputs, scenario: Scenario) {
  const kpis = calculateKPIs(inputs, scenario);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const seasonality = [0.7, 0.75, 0.85, 0.9, 1.0, 1.1, 1.15, 1.1, 1.05, 0.95, 0.85, 0.8];

  return months.map((month, i) => {
    const revenue = Math.round(kpis.totalRevenueMonth * seasonality[i]);
    const costs = Math.round(kpis.ebitdaMonth < kpis.totalRevenueMonth ? (kpis.totalRevenueMonth - kpis.ebitdaMonth) : 0);
    return {
      month,
      revenue,
      costs,
      profit: revenue - costs,
    };
  });
}