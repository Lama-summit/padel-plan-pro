import { ProjectInputs, Scenario, SCENARIO_MULTIPLIERS } from "./types";

export function calculateKPIs(inputs: ProjectInputs, scenario: Scenario) {
  const m = SCENARIO_MULTIPLIERS[scenario];

  const peakOcc = Math.min(100, Math.max(0, inputs.peakOccupancy + m.occupancyOffset)) / 100;
  const offPeakOcc = Math.min(100, Math.max(0, inputs.offPeakOccupancy + m.occupancyOffset)) / 100;

  const offPeakHours = inputs.openingHoursPerDay - inputs.peakHoursPerDay;
  const dailyCourtRevenue =
    inputs.peakPrice * inputs.peakHoursPerDay * peakOcc +
    inputs.offPeakPrice * offPeakHours * offPeakOcc;
  const annualCourtRevenue =
    dailyCourtRevenue * inputs.numberOfCourts * inputs.operatingDaysPerYear * m.revenueMultiplier;

  const annualClassRevenue =
    inputs.classesPerWeek * 52 * inputs.avgClassPrice * inputs.avgClassSize * m.revenueMultiplier;
  const annualOtherRevenue =
    (inputs.otherMonthlyRevenue + inputs.proshopRevenue + inputs.fAndBRevenue + inputs.membershipFees) *
    12 *
    m.revenueMultiplier;

  const annualRevenue = annualCourtRevenue + annualClassRevenue + annualOtherRevenue;

  const annualCosts = inputs.monthlyOperatingCosts * 12 * m.costMultiplier;
  const annualCoachingCost = inputs.classesPerWeek * 52 * inputs.coachingCostPerHour;
  const totalAnnualCosts = annualCosts + annualCoachingCost;

  const ebitda = annualRevenue - totalAnnualCosts;
  const roi = inputs.initialInvestment > 0 ? (ebitda / inputs.initialInvestment) * 100 : 0;
  const paybackYears = ebitda > 0 ? inputs.initialInvestment / ebitda : Infinity;

  // Break-even occupancy: find occ% where revenue = costs
  const revenuePerOccPoint =
    (inputs.peakPrice * inputs.peakHoursPerDay + inputs.offPeakPrice * offPeakHours) *
    inputs.numberOfCourts *
    inputs.operatingDaysPerYear *
    m.revenueMultiplier / 100;
  const breakEvenOccupancy = revenuePerOccPoint > 0 ? (totalAnnualCosts / revenuePerOccPoint) : 0;

  const weightedOccupancy =
    (inputs.peakOccupancy * inputs.peakHoursPerDay + inputs.offPeakOccupancy * offPeakHours) /
    inputs.openingHoursPerDay;

  return {
    totalInvestment: inputs.initialInvestment,
    annualRevenue,
    annualCosts: totalAnnualCosts,
    ebitda,
    roi,
    paybackYears,
    breakEvenOccupancy: Math.min(100, Math.max(0, breakEvenOccupancy)),
    weightedOccupancy: weightedOccupancy + m.occupancyOffset,
    annualCourtRevenue,
    annualClassRevenue,
    annualOtherRevenue,
  };
}

export function getMonthlyEvolution(inputs: ProjectInputs, scenario: Scenario) {
  const kpis = calculateKPIs(inputs, scenario);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const seasonality = [0.7, 0.75, 0.85, 0.9, 1.0, 1.1, 1.15, 1.1, 1.05, 0.95, 0.85, 0.8];

  return months.map((month, i) => ({
    month,
    revenue: Math.round((kpis.annualRevenue / 12) * seasonality[i]),
    costs: Math.round(kpis.annualCosts / 12),
    profit: Math.round((kpis.annualRevenue / 12) * seasonality[i] - kpis.annualCosts / 12),
  }));
}
