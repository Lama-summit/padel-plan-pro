export type Scenario = "base" | "optimistic" | "pessimistic";

export type CostMode = "basic" | "detailed";

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
  offPeakOccupancy: number; // 0-100
  peakOccupancy: number; // 0-100

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

  // Cost mode
  costMode: CostMode;

  // Detailed cost model — fixed
  staffCostPerCourtHour: number;   // €/court-hour for staffing
  softwareManagementCost: number;  // €/month

  // Detailed cost model — variable
  energyCostPerHour: number;       // €/court-hour
  maintenanceCostPerUsage: number; // €/booked-court-hour
  cleaningCostPerDay: number;      // €/court/day

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
}

export const SCENARIO_MULTIPLIERS: Record<Scenario, ScenarioMultipliers> = {
  base: { occupancyOffset: 0, pricingMultiplier: 1.0 },
  optimistic: { occupancyOffset: 10, pricingMultiplier: 1.05 },
  pessimistic: { occupancyOffset: -10, pricingMultiplier: 0.95 },
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
  initialInvestment: 500000,
  courtConstructionCost: 80000,
  facilityBuildout: 120000,
  equipmentCost: 20000,
  monthlyOperatingCosts: 25000,
  staffCosts: 12000,
  utilitiesCosts: 3000,
  maintenanceCosts: 2000,
  rentOrMortgage: 5000,
  marketingCosts: 2000,
  insuranceCosts: 1000,

  // Cost mode
  costMode: "basic",

  // Detailed costs
  staffCostPerCourtHour: 4,
  softwareManagementCost: 500,
  energyCostPerHour: 3,
  maintenanceCostPerUsage: 1.5,
  cleaningCostPerDay: 15,

  classesPerWeek: 10,
  avgClassPrice: 15,
  avgClassSize: 8,
  coachingCostPerHour: 25,
  otherMonthlyRevenue: 3000,
  proshopRevenue: 1500,
  fAndBRevenue: 2000,
  membershipFees: 500,
  debtPercentage: 60,
  interestRate: 5,
  loanTermYears: 10,
};
