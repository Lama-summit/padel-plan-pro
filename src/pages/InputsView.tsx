import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStore } from "@/lib/store";
import { ProjectInputs } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Copy } from "lucide-react";

type Category =
  | "investment"
  | "courts"
  | "hours"
  | "pricing"
  | "occupancy"
  | "classes"
  | "otherRevenue"
  | "operatingCosts"
  | "financing";

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "investment", label: "Initial Investment" },
  { key: "courts", label: "Courts & Capacity" },
  { key: "hours", label: "Opening Hours" },
  { key: "pricing", label: "Pricing" },
  { key: "occupancy", label: "Occupancy" },
  { key: "classes", label: "Classes / Coaching" },
  { key: "otherRevenue", label: "Other Revenue" },
  { key: "operatingCosts", label: "Operating Costs" },
  { key: "financing", label: "Financing" },
];

const CATEGORY_FIELDS: Record<Category, { key: keyof ProjectInputs; label: string; suffix?: string }[]> = {
  investment: [
    { key: "initialInvestment", label: "Total Initial Investment", suffix: "€" },
    { key: "courtConstructionCost", label: "Court Construction Cost", suffix: "€" },
    { key: "facilityBuildout", label: "Facility Buildout", suffix: "€" },
    { key: "equipmentCost", label: "Equipment Cost", suffix: "€" },
  ],
  courts: [
    { key: "numberOfCourts", label: "Number of Courts" },
  ],
  hours: [
    { key: "openingHoursPerDay", label: "Opening Hours/Day", suffix: "hrs" },
    { key: "operatingDaysPerYear", label: "Operating Days/Year", suffix: "days" },
    { key: "peakHoursPerDay", label: "Peak Hours/Day", suffix: "hrs" },
  ],
  pricing: [
    { key: "offPeakPrice", label: "Off-Peak Price", suffix: "€/hr" },
    { key: "peakPrice", label: "Peak Price", suffix: "€/hr" },
  ],
  occupancy: [
    { key: "offPeakOccupancy", label: "Off-Peak Occupancy", suffix: "%" },
    { key: "peakOccupancy", label: "Peak Occupancy", suffix: "%" },
  ],
  classes: [
    { key: "classesPerWeek", label: "Classes per Week" },
    { key: "avgClassPrice", label: "Avg Class Price", suffix: "€" },
    { key: "avgClassSize", label: "Avg Class Size", suffix: "players" },
    { key: "coachingCostPerHour", label: "Coaching Cost/Hour", suffix: "€" },
  ],
  otherRevenue: [
    { key: "otherMonthlyRevenue", label: "Other Monthly Revenue", suffix: "€" },
    { key: "proshopRevenue", label: "Pro Shop Revenue/Month", suffix: "€" },
    { key: "fAndBRevenue", label: "F&B Revenue/Month", suffix: "€" },
    { key: "membershipFees", label: "Membership Fees/Month", suffix: "€" },
  ],
  operatingCosts: [
    { key: "monthlyOperatingCosts", label: "Total Monthly OpCosts", suffix: "€" },
    { key: "staffCosts", label: "Staff Costs/Month", suffix: "€" },
    { key: "utilitiesCosts", label: "Utilities/Month", suffix: "€" },
    { key: "maintenanceCosts", label: "Maintenance/Month", suffix: "€" },
    { key: "rentOrMortgage", label: "Rent or Mortgage/Month", suffix: "€" },
    { key: "marketingCosts", label: "Marketing/Month", suffix: "€" },
    { key: "insuranceCosts", label: "Insurance/Month", suffix: "€" },
  ],
  financing: [
    { key: "loanAmount", label: "Loan Amount", suffix: "€" },
    { key: "interestRate", label: "Interest Rate", suffix: "%" },
    { key: "loanTermYears", label: "Loan Term", suffix: "years" },
  ],
};

export default function InputsView() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { getProject, updateVersionInputs, duplicateVersion } = useStore();
  const [activeCategory, setActiveCategory] = useState<Category>("investment");

  const project = getProject(projectId!);
  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  const version = project.versions.find((v) => v.id === project.activeVersionId) || project.versions[0];

  const handleChange = (key: keyof ProjectInputs, value: string) => {
    const numVal = key === "courtType" ? value as any : parseFloat(value) || 0;
    updateVersionInputs(project.id, version.id, { [key]: numVal });
  };

  const essentialFields: { key: keyof ProjectInputs; label: string; suffix?: string }[] = [
    { key: "numberOfCourts", label: "Number of Courts" },
    { key: "openingHoursPerDay", label: "Hours/Day", suffix: "hrs" },
    { key: "offPeakPrice", label: "Off-Peak Price", suffix: "€" },
    { key: "peakPrice", label: "Peak Price", suffix: "€" },
    { key: "offPeakOccupancy", label: "Off-Peak Occ.", suffix: "%" },
    { key: "peakOccupancy", label: "Peak Occ.", suffix: "%" },
    { key: "initialInvestment", label: "Investment", suffix: "€" },
    { key: "monthlyOperatingCosts", label: "Monthly OpCosts", suffix: "€" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/project/${project.id}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">{project.name}</h1>
            <p className="text-sm text-muted-foreground">Editing: {version.name}</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => duplicateVersion(project.id, version.id)}>
            <Copy className="h-3.5 w-3.5" /> Duplicate Version
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => navigate(`/project/${project.id}`)}>
            <Save className="h-3.5 w-3.5" /> Save & Back
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 flex gap-6 animate-fade-in">
        {/* Sidebar */}
        <aside className="w-56 flex-shrink-0 hidden lg:block">
          <nav className="space-y-1 sticky top-24">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeCategory === cat.key
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Mobile category selector */}
          <div className="lg:hidden">
            <Select value={activeCategory} onValueChange={(v) => setActiveCategory(v as Category)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.key} value={cat.key}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Essential Inputs */}
          <div className="bg-card border rounded-xl p-6">
            <h2 className="font-semibold text-lg mb-4">Essential Inputs</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {essentialFields.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{field.label}</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={version.inputs[field.key] as number}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      className="pr-10"
                    />
                    {field.suffix && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        {field.suffix}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {/* Court type selector */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Court Type</Label>
                <Select value={version.inputs.courtType} onValueChange={(v) => handleChange("courtType", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="indoor">Indoor</SelectItem>
                    <SelectItem value="outdoor">Outdoor</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Category-specific inputs */}
          <div className="bg-card border rounded-xl p-6">
            <h2 className="font-semibold text-lg mb-4">
              {CATEGORIES.find((c) => c.key === activeCategory)?.label}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {CATEGORY_FIELDS[activeCategory].map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{field.label}</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={version.inputs[field.key] as number}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      className="pr-12"
                    />
                    {field.suffix && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        {field.suffix}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
