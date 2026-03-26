export type Scenario = "base" | "optimistic" | "pessimistic";

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
  
  // Operating Costs
  monthlyOperatingCosts: number;
  staffCosts: number;
  utilitiesCosts: number;
  maintenanceCosts: number;
  rentOrMortgage: number;
  marketingCosts: number;
  insuranceCosts: number;
  
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
  loanAmount: number;
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
  revenueMultiplier: number;
  costMultiplier: number;
  occupancyOffset: number; // percentage points
}

export const SCENARIO_MULTIPLIERS: Record<Scenario, ScenarioMultipliers> = {
  base: { revenueMultiplier: 1, costMultiplier: 1, occupancyOffset: 0 },
  optimistic: { revenueMultiplier: 1.15, costMultiplier: 0.95, occupancyOffset: 10 },
  pessimistic: { revenueMultiplier: 0.85, costMultiplier: 1.1, occupancyOffset: -10 },
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
  classesPerWeek: 10,
  avgClassPrice: 15,
  avgClassSize: 8,
  coachingCostPerHour: 25,
  otherMonthlyRevenue: 3000,
  proshopRevenue: 1500,
  fAndBRevenue: 2000,
  membershipFees: 500,
  loanAmount: 300000,
  interestRate: 5,
  loanTermYears: 10,
};
