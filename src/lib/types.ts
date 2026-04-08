export type Scenario = "base" | "optimistic" | "pessimistic";

export type CostMode = "basic" | "detailed";

export type MarketPreset = "premium" | "standard" | "lowcost" | "custom";

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

  // Classes / Coaching
  classesPerWeek: number;
  avgClassPrice: number;
  avgClassSize: number;
  coachingCostPerHour: number;

  // Other Revenue
  otherMonthlyRevenue: number;
  proshopRevenue: number;
  fAndBRevenue: number;
  membershipFees: number;

  // Financing
  debtPercentage: number;
  interestRate: number;
  loanTermYears: number;
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
  initialInvestment: 80000 * 4 + 120000 + 20000, // auto: courts × cost + buildout + equipment
  courtConstructionCost: 80000,
  facilityBuildout: 120000,
  equipmentCost: 20000,
  monthlyOperatingCosts: 12000 + 3000 + 2000 + 5000 + 2000 + 1000, // auto: sum of cost lines
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
  classesPerWeek: 10,
  avgClassPrice: 15,
  avgClassSize: 8,
  coachingCostPerHour: 25,
  otherMonthlyRevenue: 1500 + 2000 + 500, // auto: sum of revenue lines
  proshopRevenue: 1500,
  fAndBRevenue: 2000,
  membershipFees: 500,
  debtPercentage: 60,
  interestRate: 5,
  loanTermYears: 10,
};

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
