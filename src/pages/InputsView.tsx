import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStore } from "@/lib/store";
import { ProjectInputs, CostMode } from "@/lib/types";
import { KeyDriversPanel } from "@/components/KeyDriversPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Save,
  Copy,
  Landmark,
  Clock,
  GraduationCap,
  Store,
  Wallet,
  Banknote,
} from "lucide-react";
import { LucideIcon } from "lucide-react";

/* ─── Key driver field keys (excluded from category panels) ── */
const KEY_DRIVER_KEYS: Set<keyof ProjectInputs> = new Set([
  "numberOfCourts",
  "openingHoursPerDay",
  "offPeakPrice",
  "peakPrice",
  "offPeakOccupancy",
  "peakOccupancy",
  "courtType",
]);

type Category =
  | "investment"
  | "hours"
  | "classes"
  | "otherRevenue"
  | "operatingCosts"
  | "detailedCosts"
  | "financing";

const CATEGORIES: { key: Category; label: string; icon: LucideIcon; description: string }[] = [
  { key: "investment", label: "Initial Investment", icon: Landmark, description: "Setup and construction costs" },
  { key: "hours", label: "Schedule & Peak", icon: Clock, description: "Operating schedule details" },
  { key: "classes", label: "Classes / Coaching", icon: GraduationCap, description: "Lessons and coaching revenue" },
  { key: "otherRevenue", label: "Other Revenue", icon: Store, description: "Pro shop, F&B, memberships" },
  { key: "operatingCosts", label: "Operating Costs", icon: Wallet, description: "Monthly running expenses (basic mode)" },
  { key: "detailedCosts", label: "Detailed Costs", icon: Wallet, description: "Structured fixed & variable costs" },
  { key: "financing", label: "Financing", icon: Banknote, description: "Loans and interest" },
];

interface FieldDef {
  key: keyof ProjectInputs;
  label: string;
  suffix?: string;
  helper?: string;
  slider?: { min: number; max: number; step: number };
}

const CATEGORY_FIELDS: Record<Category, FieldDef[]> = {
  investment: [
    { key: "initialInvestment", label: "Total Initial Investment", suffix: "€", helper: "Total capital required to launch" },
    { key: "courtConstructionCost", label: "Court Construction Cost", suffix: "€", helper: "Per-court construction budget" },
    { key: "facilityBuildout", label: "Facility Buildout", suffix: "€", helper: "Clubhouse, reception, amenities" },
    { key: "equipmentCost", label: "Equipment Cost", suffix: "€", helper: "Nets, lighting, furniture" },
  ],
  hours: [
    { key: "operatingDaysPerYear", label: "Operating Days / Year", suffix: "days" },
    { key: "peakHoursPerDay", label: "Peak Hours / Day", suffix: "hrs", slider: { min: 1, max: 10, step: 1 } },
  ],
  classes: [
    { key: "classesPerWeek", label: "Classes per Week", slider: { min: 0, max: 30, step: 1 } },
    { key: "avgClassPrice", label: "Avg Class Price", suffix: "€" },
    { key: "avgClassSize", label: "Avg Class Size", suffix: "players" },
    { key: "coachingCostPerHour", label: "Coaching Cost / Hour", suffix: "€" },
  ],
  otherRevenue: [
    { key: "otherMonthlyRevenue", label: "Other Monthly Revenue", suffix: "€" },
    { key: "proshopRevenue", label: "Pro Shop Revenue / Month", suffix: "€" },
    { key: "fAndBRevenue", label: "F&B Revenue / Month", suffix: "€" },
    { key: "membershipFees", label: "Membership Fees / Month", suffix: "€" },
  ],
  operatingCosts: [
    { key: "monthlyOperatingCosts", label: "Total Monthly OpCosts", suffix: "€", helper: "Sum of all monthly costs" },
    { key: "staffCosts", label: "Staff Costs / Month", suffix: "€" },
    { key: "utilitiesCosts", label: "Utilities / Month", suffix: "€" },
    { key: "maintenanceCosts", label: "Maintenance / Month", suffix: "€" },
    { key: "rentOrMortgage", label: "Rent or Mortgage / Month", suffix: "€" },
    { key: "marketingCosts", label: "Marketing / Month", suffix: "€" },
    { key: "insuranceCosts", label: "Insurance / Month", suffix: "€" },
  ],
  detailedCosts: [
    { key: "staffCostPerCourtHour", label: "Staff Cost / Court-Hour", suffix: "€", helper: "Scales with courts × hours" },
    { key: "softwareManagementCost", label: "Software & Management", suffix: "€/mo" },
    { key: "energyCostPerHour", label: "Energy / Court-Hour", suffix: "€", helper: "Scales with operating hours" },
    { key: "maintenanceCostPerUsage", label: "Maintenance / Booked Hour", suffix: "€", helper: "Scales with usage" },
    { key: "cleaningCostPerDay", label: "Cleaning / Court / Day", suffix: "€" },
  ],
  financing: [
    { key: "debtPercentage", label: "Debt Percentage", suffix: "%", slider: { min: 0, max: 100, step: 5 }, helper: "% of investment financed by loan" },
    { key: "interestRate", label: "Interest Rate", suffix: "%", slider: { min: 0, max: 15, step: 0.25 } },
    { key: "loanTermYears", label: "Loan Term", suffix: "years", slider: { min: 1, max: 30, step: 1 } },
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

  const handleChange = (key: keyof ProjectInputs, value: string | number) => {
    const numVal = key === "courtType" ? value as any : typeof value === "number" ? value : parseFloat(value) || 0;
    const patch: Partial<ProjectInputs> = { [key]: numVal };

    // Auto-compute Total Initial Investment from components
    const next = { ...version.inputs, ...patch };
    if (key === "courtConstructionCost" || key === "facilityBuildout" || key === "equipmentCost" || key === "numberOfCourts") {
      patch.initialInvestment =
        (next.courtConstructionCost * next.numberOfCourts) +
        next.facilityBuildout +
        next.equipmentCost;
    }

    updateVersionInputs(project.id, version.id, patch);
  };

  const activeCat = CATEGORIES.find((c) => c.key === activeCategory)!;

  // Filter out key-driver fields from category panels
  const categoryFields = CATEGORY_FIELDS[activeCategory].filter(
    (f) => !KEY_DRIVER_KEYS.has(f.key)
  );

  const renderField = (field: FieldDef) => {
    const currentVal = version.inputs[field.key] as number;

    return (
      <div key={field.key} className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-foreground">{field.label}</Label>
          {field.suffix && (
            <span className="text-xs text-muted-foreground font-medium">{field.suffix}</span>
          )}
        </div>
        {field.slider ? (
          <div className="space-y-3">
            <Slider
              value={[currentVal]}
              min={field.slider.min}
              max={field.slider.max}
              step={field.slider.step}
              onValueChange={([v]) => handleChange(field.key, v)}
              className="py-1"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{field.slider.min}{field.suffix ? ` ${field.suffix}` : ''}</span>
              <span className="text-lg font-bold text-foreground">{currentVal}{field.suffix ? ` ${field.suffix}` : ''}</span>
              <span className="text-xs text-muted-foreground">{field.slider.max}{field.suffix ? ` ${field.suffix}` : ''}</span>
            </div>
          </div>
        ) : (
          <div className="relative">
            <Input
              type="number"
              value={currentVal}
              onChange={(e) => handleChange(field.key, e.target.value)}
              className="pr-12 rounded-xl h-11 text-base font-medium"
            />
            {field.suffix && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
                {field.suffix}
              </span>
            )}
          </div>
        )}
        {field.helper && (
          <p className="text-xs text-muted-foreground">{field.helper}</p>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-full mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => navigate(`/project/${project.id}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">{project.name}</h1>
            <p className="text-sm text-muted-foreground">Editing: {version.name}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 rounded-xl"
            onClick={() => duplicateVersion(project.id, version.id)}
          >
            <Copy className="h-4 w-4" /> Duplicate
          </Button>
          <Button
            size="sm"
            className="gap-2 rounded-xl"
            onClick={() => navigate(`/project/${project.id}`)}
          >
            <Save className="h-4 w-4" /> Save & Back
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main content area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-8 flex gap-8 animate-fade-in">
            {/* Sidebar */}
            <aside className="w-56 flex-shrink-0 hidden lg:block">
              <nav className="space-y-1 sticky top-24">
                <p className="section-title px-3 mb-3">Categories</p>
                {CATEGORIES.map((cat) => {
                  const CatIcon = cat.icon;
                  const isActive = activeCategory === cat.key;
                  return (
                    <button
                      key={cat.key}
                      onClick={() => setActiveCategory(cat.key)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all flex items-center gap-3 group ${
                        isActive
                          ? "bg-primary text-primary-foreground font-medium shadow-md shadow-primary/20"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <CatIcon className={`h-4 w-4 flex-shrink-0 ${isActive ? '' : 'text-muted-foreground group-hover:text-foreground'}`} />
                      <span className="truncate">{cat.label}</span>
                    </button>
                  );
                })}
              </nav>
            </aside>

            {/* Main */}
            <div className="flex-1 min-w-0 space-y-8">
              {/* Mobile category selector */}
              <div className="lg:hidden">
                <Select value={activeCategory} onValueChange={(v) => setActiveCategory(v as Category)}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.key} value={cat.key}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Category-specific inputs */}
              <div className="bg-card border rounded-2xl p-7">
                <div className="flex items-center gap-3 mb-1">
                  <activeCat.icon className="h-5 w-5 text-primary" />
                  <h2 className="font-bold text-lg">{activeCat.label}</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-6 ml-8">{activeCat.description}</p>
                {categoryFields.length > 0 ? (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {categoryFields.map(renderField)}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">All inputs for this category are available in the Key Drivers panel →</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right-side Key Drivers Panel */}
        <KeyDriversPanel
          inputs={version.inputs}
          onChange={handleChange}
          className="hidden lg:flex lg:flex-col sticky top-0 h-screen"
        />
      </div>
    </div>
  );
}
