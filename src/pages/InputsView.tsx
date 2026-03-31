import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStore } from "@/lib/store";
import { ProjectInputs } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
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
  LayoutGrid,
  Clock,
  Tag,
  BarChart3,
  GraduationCap,
  Store,
  Wallet,
  Banknote,
  Zap,
} from "lucide-react";
import { LucideIcon } from "lucide-react";

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

const CATEGORIES: { key: Category; label: string; icon: LucideIcon; description: string }[] = [
  { key: "investment", label: "Initial Investment", icon: Landmark, description: "Setup and construction costs" },
  { key: "courts", label: "Courts & Capacity", icon: LayoutGrid, description: "Number and type of courts" },
  { key: "hours", label: "Opening Hours", icon: Clock, description: "Operating schedule" },
  { key: "pricing", label: "Pricing", icon: Tag, description: "Court rental pricing" },
  { key: "occupancy", label: "Occupancy", icon: BarChart3, description: "Expected usage rates" },
  { key: "classes", label: "Classes / Coaching", icon: GraduationCap, description: "Lessons and coaching revenue" },
  { key: "otherRevenue", label: "Other Revenue", icon: Store, description: "Pro shop, F&B, memberships" },
  { key: "operatingCosts", label: "Operating Costs", icon: Wallet, description: "Monthly running expenses" },
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
  courts: [
    { key: "numberOfCourts", label: "Number of Courts", slider: { min: 1, max: 16, step: 1 } },
  ],
  hours: [
    { key: "openingHoursPerDay", label: "Opening Hours / Day", suffix: "hrs", slider: { min: 6, max: 20, step: 1 } },
    { key: "operatingDaysPerYear", label: "Operating Days / Year", suffix: "days" },
    { key: "peakHoursPerDay", label: "Peak Hours / Day", suffix: "hrs", slider: { min: 1, max: 10, step: 1 } },
  ],
  pricing: [
    { key: "offPeakPrice", label: "Off-Peak Price", suffix: "€/hr" },
    { key: "peakPrice", label: "Peak Price", suffix: "€/hr" },
  ],
  occupancy: [
    { key: "offPeakOccupancy", label: "Off-Peak Occupancy", suffix: "%", slider: { min: 0, max: 100, step: 5 } },
    { key: "peakOccupancy", label: "Peak Occupancy", suffix: "%", slider: { min: 0, max: 100, step: 5 } },
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
    updateVersionInputs(project.id, version.id, { [key]: numVal });
  };

  const essentialFields: FieldDef[] = [
    { key: "numberOfCourts", label: "Number of Courts", slider: { min: 1, max: 16, step: 1 } },
    { key: "openingHoursPerDay", label: "Hours / Day", suffix: "hrs", slider: { min: 6, max: 20, step: 1 } },
    { key: "offPeakPrice", label: "Off-Peak Price", suffix: "€/hr" },
    { key: "peakPrice", label: "Peak Price", suffix: "€/hr" },
    { key: "offPeakOccupancy", label: "Off-Peak Occupancy", suffix: "%", slider: { min: 0, max: 100, step: 5 } },
    { key: "peakOccupancy", label: "Peak Occupancy", suffix: "%", slider: { min: 0, max: 100, step: 5 } },
    { key: "initialInvestment", label: "Initial Investment", suffix: "€" },
    { key: "monthlyOperatingCosts", label: "Monthly OpCosts", suffix: "€" },
  ];

  const activeCat = CATEGORIES.find((c) => c.key === activeCategory)!;

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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
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

      <div className="max-w-7xl mx-auto px-6 py-8 flex gap-8 animate-fade-in">
        {/* Sidebar */}
        <aside className="w-60 flex-shrink-0 hidden lg:block">
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

          {/* Essential Inputs */}
          <div className="bg-card border-2 border-accent/15 rounded-2xl p-7">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl gradient-accent flex items-center justify-center shadow-md shadow-accent/20">
                <Zap className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <h2 className="font-bold text-lg">Key Business Drivers</h2>
                <p className="text-xs text-muted-foreground">Core inputs that most impact your results</p>
              </div>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {essentialFields.map(renderField)}
              {/* Court type toggle */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Court Type</Label>
                <div className="flex bg-muted rounded-xl p-1 gap-0.5">
                  {(["indoor", "outdoor", "mixed"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => handleChange("courtType", type)}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg transition-all font-medium capitalize ${
                        version.inputs.courtType === type
                          ? "bg-card shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Category-specific inputs */}
          <div className="bg-card border rounded-2xl p-7">
            <div className="flex items-center gap-3 mb-1">
              <activeCat.icon className="h-5 w-5 text-primary" />
              <h2 className="font-bold text-lg">{activeCat.label}</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-6 ml-8">{activeCat.description}</p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {CATEGORY_FIELDS[activeCategory].map(renderField)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}