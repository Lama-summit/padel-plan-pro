export type Scenario = "base" | "optimistic" | "pessimistic";

export type CostMode = "basic" | "detailed";

export type MarketPreset = "premium" | "standard" | "lowcost" | "custom";

export interface RevenueLineItem {
  id: string;
  name: string;
  monthlyRevenue: number;
  monthlyCost: number;
}

export interface InvestorEntry {
  id: string;
  name: string;
  investment: number;
}

export interface TimelinePhase {
  id: string;
  phase: string;
  monthRange: string;
  description: string;
  amount: number;
}

export interface ProjectInputs {
  // Courts & Capacity
  numberOfCourts: number;
  courtType: "indoor" | "outdoor" | "mixed";

  // Opening Hours
  openingHoursPerDay: number;
  operatingDaysPerYear: number;
  peakHoursPerDay: number;

  // Pricing
  offPeakPrice: number;
  peakPrice: number;

  // Occupancy
  offPeakOccupancy: number;
  peakOccupancy: number;

  // Investment
  initialInvestment: number;
  courtConstructionCost: number;
  facilityBuildout: number;
  equipmentCost: number;

  // Operating Costs (legacy / basic mode)
  monthlyOperatingCosts: number;
  staffCosts: number;
  utilitiesCosts: number;
  maintenanceCosts: number;
  rentOrMortgage: number;
  marketingCosts: number;
  insuranceCosts: number;

  // Variable cost component (basic mode)
  variableCostPerHour: number;

  // Cost mode
  costMode: CostMode;

  // Detailed cost model — fixed
  staffCostPerCourtHour: number;
  softwareManagementCost: number;

  // Detailed cost model — variable
  energyCostPerHour: number;
  maintenanceCostPerUsage: number;
  cleaningCostPerDay: number;

  // ─── Revenue Modules ───────────────────────────────────────

  // Module A: Coaching / Classes
  coachingEnabled: boolean;
  coachingHoursPerDay: number;    // hours/day allocated to coaching
  coachingPctOfHours: number;     // % of total court hours used for coaching
  coachingPricePerHour: number;   // avg price per coaching hour
  coachingCostShare: number;      // coach revenue share (% cost)

  // Legacy class fields (kept for backwards compat, now derived from coaching module)
  classesPerWeek: number;
  avgClassPrice: number;
  avgClassSize: number;
  coachingCostPerHour: number;

  // Module B: Tournaments / Events
  tournamentsEnabled: boolean;
  tournamentsPerMonth: number;
  tournamentRevenuePerEvent: number;
  tournamentCostPerEvent: number;
  eventsEnabled: boolean;
  eventsPerMonth: number;
  avgRevenuePerEvent: number;
  avgCostPerEvent: number;
  eventRevenuePerEvent: number;
  eventCostPerEvent: number;

  // Module C: Other Revenue
  otherRevenueEnabled: boolean;
  otherRevenueItems: RevenueLineItem[];
  otherRevenueMode: "fixed" | "pctOfBookings" | "perBooking";
  otherMonthlyRevenue: number;
  otherRevenuePctOfBookings: number;
  otherRevenuePerBooking: number;
  proshopRevenue: number;
  fAndBRevenue: number;
  membershipFees: number;

  // Financing
  debtPercentage: number;
  interestRate: number;
  loanTermYears: number;

  // Distribution Policy
  distributionInvestorsPct: number;
  distributionFoundersPct: number;
  distributionReinvestmentPct: number;

  // Equity Structure
  investors: InvestorEntry[];

  // Investment Timeline
  timelinePhases: TimelinePhase[];
}

export interface ProjectVersion {
  id: string;
  name: string;
  createdAt: string;
  inputs: ProjectInputs;
}

export interface Project {
  id: string;
  name: string;
  location: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
  status: "draft" | "active" | "archived";
  versions: ProjectVersion[];
  activeVersionId: string;
}

export interface ScenarioMultipliers {
  occupancyOffset: number;
  pricingMultiplier: number;
  costMultiplier: number;
  capexMultiplier: number;
}

export const SCENARIO_MULTIPLIERS: Record<Scenario, ScenarioMultipliers> = {
  base: { occupancyOffset: 0, pricingMultiplier: 1.0, costMultiplier: 1.0, capexMultiplier: 1.0 },
  optimistic: { occupancyOffset: 10, pricingMultiplier: 1.05, costMultiplier: 0.95, capexMultiplier: 0.95 },
  pessimistic: { occupancyOffset: -10, pricingMultiplier: 0.95, costMultiplier: 1.05, capexMultiplier: 1.10 },
};

export const DEFAULT_INPUTS: ProjectInputs = {
  numberOfCourts: 4,
  courtType: "indoor",
  openingHoursPerDay: 14,
  operatingDaysPerYear: 350,
  peakHoursPerDay: 5,
  offPeakPrice: 30,
  peakPrice: 50,
  offPeakOccupancy: 45,
  peakOccupancy: 75,
  initialInvestment: 80000 * 4 + 120000 + 20000,
  courtConstructionCost: 80000,
  facilityBuildout: 120000,
  equipmentCost: 20000,
  monthlyOperatingCosts: 12000 + 3000 + 2000 + 5000 + 2000 + 1000,
  staffCosts: 12000,
  utilitiesCosts: 3000,
  maintenanceCosts: 2000,
  rentOrMortgage: 5000,
  marketingCosts: 2000,
  insuranceCosts: 1000,
  variableCostPerHour: 2,
  costMode: "basic",
  staffCostPerCourtHour: 4,
  softwareManagementCost: 500,
  energyCostPerHour: 3,
  maintenanceCostPerUsage: 1.5,
  cleaningCostPerDay: 15,

  // Coaching module
  coachingEnabled: true,
  coachingHoursPerDay: 4,
  coachingPctOfHours: 15,
  coachingPricePerHour: 60,
  coachingCostShare: 40,

  // Legacy class fields
  classesPerWeek: 10,
  avgClassPrice: 15,
  avgClassSize: 8,
  coachingCostPerHour: 25,

  // Tournaments module
  tournamentsEnabled: false,
  tournamentsPerMonth: 2,
  tournamentRevenuePerEvent: 1500,
  tournamentCostPerEvent: 500,
  eventsEnabled: false,
  eventsPerMonth: 2,
  avgRevenuePerEvent: 1500,
  avgCostPerEvent: 500,
  eventRevenuePerEvent: 1200,
  eventCostPerEvent: 450,

  // Other revenue module
  otherRevenueEnabled: true,
  otherRevenueItems: [
    { id: "rev-proshop", name: "Pro Shop", monthlyRevenue: 1500, monthlyCost: 0 },
    { id: "rev-fb", name: "F&B", monthlyRevenue: 2000, monthlyCost: 0 },
    { id: "rev-memberships", name: "Memberships", monthlyRevenue: 500, monthlyCost: 0 },
  ],
  otherRevenueMode: "fixed",
  otherMonthlyRevenue: 4000,
  otherRevenuePctOfBookings: 10,
  otherRevenuePerBooking: 5,
  proshopRevenue: 1500,
  fAndBRevenue: 2000,
  membershipFees: 500,

  debtPercentage: 60,
  interestRate: 5,
  loanTermYears: 10,

  // Distribution Policy
  distributionInvestorsPct: 40,
  distributionFoundersPct: 30,
  distributionReinvestmentPct: 30,

  // Equity Structure
  investors: [
    { id: "inv-lead", name: "Lead Investor", investment: 0 },
  ],

  // Investment Timeline
  timelinePhases: [
    { id: "phase-1", phase: "Planning & Permits", monthRange: "1-2", description: "Permits, design, legal", amount: 0 },
    { id: "phase-2", phase: "Construction", monthRange: "3-6", description: "Court building & facility", amount: 0 },
    { id: "phase-3", phase: "Equipment & Setup", monthRange: "7-8", description: "Equipment, furnishing, testing", amount: 0 },
  ],
};

export function createRevenueLineItem(
  name = "New Revenue",
  monthlyRevenue = 0,
  monthlyCost = 0,
  id?: string,
): RevenueLineItem {
  return {
    id: id ?? `rev-${Math.random().toString(36).slice(2, 10)}`,
    name,
    monthlyRevenue,
    monthlyCost,
  };
}

export function normalizeProjectInputs(raw?: Partial<ProjectInputs> | null): ProjectInputs {
  const source = raw ?? {};

  const legacyOtherRevenueItems = [
    createRevenueLineItem("Pro Shop", source.proshopRevenue ?? DEFAULT_INPUTS.proshopRevenue, 0, "rev-proshop"),
    createRevenueLineItem("F&B", source.fAndBRevenue ?? DEFAULT_INPUTS.fAndBRevenue, 0, "rev-fb"),
    createRevenueLineItem("Memberships", source.membershipFees ?? DEFAULT_INPUTS.membershipFees, 0, "rev-memberships"),
  ].filter((item) => item.monthlyRevenue > 0 || item.monthlyCost > 0);

  const nextOtherRevenueItems = Array.isArray(source.otherRevenueItems) && source.otherRevenueItems.length > 0
    ? source.otherRevenueItems.map((item, index) => ({
        id: item?.id ?? `rev-${index}`,
        name: item?.name?.trim() || `Revenue ${index + 1}`,
        monthlyRevenue: Number(item?.monthlyRevenue ?? 0) || 0,
        monthlyCost: Number(item?.monthlyCost ?? 0) || 0,
      }))
    : legacyOtherRevenueItems.length > 0
      ? legacyOtherRevenueItems
      : DEFAULT_INPUTS.otherRevenueItems;

  return {
    ...DEFAULT_INPUTS,
    ...source,
    coachingHoursPerDay: Number(source.coachingHoursPerDay ?? DEFAULT_INPUTS.coachingHoursPerDay) || 0,
    tournamentsPerMonth: Number(source.tournamentsPerMonth ?? source.eventsPerMonth ?? DEFAULT_INPUTS.tournamentsPerMonth) || 0,
    tournamentRevenuePerEvent: Number(source.tournamentRevenuePerEvent ?? source.avgRevenuePerEvent ?? DEFAULT_INPUTS.tournamentRevenuePerEvent) || 0,
    tournamentCostPerEvent: Number(source.tournamentCostPerEvent ?? source.avgCostPerEvent ?? DEFAULT_INPUTS.tournamentCostPerEvent) || 0,
    eventsEnabled: Boolean(source.eventsEnabled ?? DEFAULT_INPUTS.eventsEnabled),
    eventRevenuePerEvent: Number(source.eventRevenuePerEvent ?? DEFAULT_INPUTS.eventRevenuePerEvent) || 0,
    eventCostPerEvent: Number(source.eventCostPerEvent ?? DEFAULT_INPUTS.eventCostPerEvent) || 0,
    otherRevenueItems: nextOtherRevenueItems,
    investors: Array.isArray(source.investors) && source.investors.length > 0
      ? source.investors.map((inv, i) => ({
          id: inv?.id ?? `inv-${i}`,
          name: inv?.name?.trim() || (i === 0 ? "Lead Investor" : `Investor ${i}`),
          investment: Number(inv?.investment ?? 0) || 0,
        }))
      : DEFAULT_INPUTS.investors,
    timelinePhases: Array.isArray(source.timelinePhases) && source.timelinePhases.length > 0
      ? source.timelinePhases.map((p, i) => ({
          id: p?.id ?? `phase-${i}`,
          phase: p?.phase?.trim() || `Phase ${i + 1}`,
          monthRange: p?.monthRange ?? "",
          description: p?.description ?? "",
          amount: Number(p?.amount ?? 0) || 0,
        }))
      : DEFAULT_INPUTS.timelinePhases,
  };
}

// ─── Market Presets ──────────────────────────────────────────
export interface MarketPresetConfig {
  label: string;
  description: string;
  overrides: Partial<ProjectInputs>;
}

export const MARKET_PRESETS: Record<Exclude<MarketPreset, "custom">, MarketPresetConfig> = {
  premium: {
    label: "Premium Urban Club",
    description: "High-end urban location with premium pricing",
    overrides: {
      offPeakPrice: 45,
      peakPrice: 75,
      offPeakOccupancy: 50,
      peakOccupancy: 80,
      monthlyOperatingCosts: 38000,
      staffCosts: 18000,
      rentOrMortgage: 10000,
      utilitiesCosts: 4500,
      courtConstructionCost: 120000,
      facilityBuildout: 200000,
      equipmentCost: 40000,
      courtType: "indoor",
    },
  },
  standard: {
    label: "Standard Club",
    description: "Typical padel club with balanced pricing",
    overrides: {
      offPeakPrice: 30,
      peakPrice: 50,
      offPeakOccupancy: 45,
      peakOccupancy: 70,
      monthlyOperatingCosts: 25000,
      staffCosts: 12000,
      rentOrMortgage: 5000,
      utilitiesCosts: 3000,
      courtType: "indoor",
    },
  },
  lowcost: {
    label: "Low-cost Club",
    description: "Budget-friendly outdoor facility",
    overrides: {
      offPeakPrice: 18,
      peakPrice: 30,
      offPeakOccupancy: 55,
      peakOccupancy: 85,
      monthlyOperatingCosts: 15000,
      staffCosts: 8000,
      rentOrMortgage: 3000,
      utilitiesCosts: 1500,
      courtConstructionCost: 40000,
      facilityBuildout: 60000,
      equipmentCost: 10000,
      courtType: "outdoor",
    },
  },
};
