import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStore } from "@/lib/store";
import { ProjectInputs, CostMode, RevenueLineItem } from "@/lib/types";
import { getCurrencySymbol, CURRENCIES, CURRENCY_OPTIONS, CurrencyCode } from "@/lib/currency";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertTriangle,
  ArrowLeft,
  Save,
  Copy,
  Landmark,
  Clock,
  Wallet,
  Banknote,
  Lock,
  DollarSign,
  Eye,
  PieChart,
  SlidersHorizontal,
} from "lucide-react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const KEY_DRIVER_KEYS: Set<keyof ProjectInputs> = new Set([
  "numberOfCourts",
  "openingHoursPerDay",
  "offPeakPrice",
  "peakPrice",
  "offPeakOccupancy",
  "peakOccupancy",
  "coachingEnabled",
  "coachingHoursPerDay",
  "coachingPricePerHour",
  "coachingCostShare",
]);

type Category =
  | "investment"
  | "hours"
  | "operatingCosts"
  | "financing"
  | "policies";

const CATEGORIES: { key: Category; label: string; icon: LucideIcon; description: string }[] = [
  { key: "investment", label: "Initial Investment", icon: Landmark, description: "Setup and construction costs" },
  { key: "hours", label: "Schedule & Peak", icon: Clock, description: "Operating schedule details" },
  { key: "operatingCosts", label: "Operating Costs", icon: Wallet, description: "Monthly running expenses" },
  { key: "financing", label: "Financing", icon: Banknote, description: "Loans and interest" },
  { key: "policies", label: "Policies", icon: PieChart, description: "EBITDA distribution policy" },
];

interface FieldDef {
  key: keyof ProjectInputs;
  label: string;
  suffix?: string;
  helper?: string;
  readonly?: boolean;
  slider?: { min: number; max: number; step: number };
}

function buildCategoryFields(sym: string): Record<Exclude<Category, "policies">, FieldDef[]> {
  return {
    investment: [
      { key: "initialInvestment", label: "Total Initial Investment", suffix: sym, helper: "Auto-calculated: (Court Cost × Courts) + Buildout + Equipment", readonly: true },
      { key: "courtConstructionCost", label: "Court Construction Cost", suffix: sym, helper: "Per-court construction budget" },
      { key: "facilityBuildout", label: "Facility Buildout", suffix: sym, helper: "Clubhouse, reception, amenities" },
      { key: "equipmentCost", label: "Equipment Cost", suffix: sym, helper: "Nets, lighting, furniture" },
    ],
    hours: [
      { key: "operatingDaysPerYear", label: "Operating Days / Year", suffix: "days" },
      { key: "peakHoursPerDay", label: "Peak Hours / Day", suffix: "hrs", slider: { min: 1, max: 10, step: 1 } },
    ],
    operatingCosts: [
      { key: "monthlyOperatingCosts", label: "Total Monthly OpCosts", suffix: sym, helper: "Auto-calculated: fixed costs + variable costs (scales with usage)", readonly: true },
      { key: "staffCosts", label: "Staff Costs / Month", suffix: sym },
      { key: "utilitiesCosts", label: "Utilities / Month", suffix: sym },
      { key: "maintenanceCosts", label: "Maintenance / Month", suffix: sym },
      { key: "rentOrMortgage", label: "Rent or Mortgage / Month", suffix: sym },
      { key: "marketingCosts", label: "Marketing / Month", suffix: sym },
      { key: "insuranceCosts", label: "Insurance / Month", suffix: sym },
      { key: "variableCostPerHour", label: "Variable Cost per Booking Hour", suffix: `${sym}/hr`, helper: "Scales with courts × occupancy × hours (e.g. consumables, extra energy)" },
    ],
    financing: [
      { key: "debtPercentage", label: "Debt Percentage", suffix: "%", slider: { min: 0, max: 100, step: 5 }, helper: "% of investment financed by loan" },
      { key: "interestRate", label: "Interest Rate", suffix: "%", slider: { min: 0, max: 15, step: 0.25 } },
      { key: "loanTermYears", label: "Loan Term", suffix: "years", slider: { min: 1, max: 30, step: 1 } },
    ],
  };
}

const DETAILED_COST_FIELDS = (sym: string): FieldDef[] => [
  { key: "staffCostPerCourtHour", label: "Staff Cost / Court-Hour", suffix: sym, helper: "Scales with courts × hours" },
  { key: "softwareManagementCost", label: "Software & Management", suffix: `${sym}/mo` },
  { key: "energyCostPerHour", label: "Energy / Court-Hour", suffix: sym, helper: "Scales with operating hours" },
  { key: "maintenanceCostPerUsage", label: "Maintenance / Booked Hour", suffix: sym, helper: "Scales with usage" },
  { key: "cleaningCostPerDay", label: "Cleaning / Court / Day", suffix: sym },
];

export default function InputsView() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { getProject, updateVersionInputs, duplicateVersion, updateProject } = useStore();
  const [activeCategory, setActiveCategory] = useState<Category>("investment");
  const [keyDriversOpen, setKeyDriversOpen] = useState(false);
  const [detailedCostsOpen, setDetailedCostsOpen] = useState(false);

  const project = getProject(projectId!);
  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  const currency = (project.currency ?? "EUR") as CurrencyCode;
  const sym = getCurrencySymbol(currency);
  const CATEGORY_FIELDS = buildCategoryFields(sym);

  const version = project.versions.find((v) => v.id === project.activeVersionId) || project.versions[0];

  const handleChange = (key: keyof ProjectInputs, value: string | number | boolean | RevenueLineItem[]) => {
    let numVal = Array.isArray(value)
      ? value
      : key === "courtType"
        ? value as any
        : typeof value === "boolean"
          ? value
          : typeof value === "number"
            ? value
            : parseFloat(value) || 0;

    if (key === "offPeakOccupancy" || key === "peakOccupancy") {
      numVal = Math.min(90, Math.max(10, numVal as number));
    }
    const patch: Partial<ProjectInputs> = { [key]: numVal };
    const next = { ...version.inputs, ...patch };

    const OPEX_KEYS: (keyof ProjectInputs)[] = ["staffCosts", "utilitiesCosts", "maintenanceCosts", "rentOrMortgage", "marketingCosts", "insuranceCosts"];
    const INVEST_KEYS: (keyof ProjectInputs)[] = ["courtConstructionCost", "facilityBuildout", "equipmentCost", "numberOfCourts"];

    if (INVEST_KEYS.includes(key)) {
      patch.initialInvestment = (next.courtConstructionCost * next.numberOfCourts) + next.facilityBuildout + next.equipmentCost;
    }
    if (OPEX_KEYS.includes(key)) {
      patch.monthlyOperatingCosts = OPEX_KEYS.reduce((sum, k) => sum + (next[k] as number || 0), 0);
    }
    if (key === "otherRevenueItems" && Array.isArray(numVal)) {
      patch.otherMonthlyRevenue = numVal.reduce((sum, item) => sum + ((item.monthlyRevenue || 0) - (item.monthlyCost || 0)), 0);
    }

    updateVersionInputs(project.id, version.id, patch);
  };

  const handleDistributionChange = (key: "distributionInvestorsPct" | "distributionFoundersPct" | "distributionReinvestmentPct", value: number) => {
    const newValue = Math.min(100, Math.max(0, value));
    updateVersionInputs(project.id, version.id, { [key]: newValue });
  };

  const handleCurrencyChange = (newCurrency: CurrencyCode) => {
    updateProject(project.id, { currency: newCurrency });
  };

  const activeCat = CATEGORIES.find((c) => c.key === activeCategory)!;

  const computeReadonly = (key: keyof ProjectInputs): number => {
    const i = version.inputs;
    switch (key) {
      case "initialInvestment": return (i.courtConstructionCost * i.numberOfCourts) + i.facilityBuildout + i.equipmentCost;
      case "monthlyOperatingCosts": {
        const fixed = i.staffCosts + i.utilitiesCosts + i.maintenanceCosts + i.rentOrMortgage + i.marketingCosts + i.insuranceCosts;
        const weightedOcc = (i.peakOccupancy * 0.4 + i.offPeakOccupancy * 0.6) / 100;
        const bookedHrs = i.numberOfCourts * i.openingHoursPerDay * weightedOcc * 30;
        return fixed + (i.variableCostPerHour * bookedHrs);
      }
      case "otherMonthlyRevenue": return i.otherRevenueItems.reduce((sum, item) => sum + item.monthlyRevenue - item.monthlyCost, 0);
      default: return i[key] as number;
    }
  };

  const renderField = (field: FieldDef) => {
    const currentVal = field.readonly ? computeReadonly(field.key) : version.inputs[field.key] as number;

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
            {field.readonly && (
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            )}
            <NumericInput
              value={currentVal}
              onChange={(v) => handleChange(field.key, v)}
              disabled={field.readonly}
              className={`pr-12 rounded-xl h-11 text-base font-medium ${field.readonly ? 'pl-9 bg-muted border-dashed cursor-not-allowed text-foreground font-bold' : ''}`}
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

  const renderPoliciesTab = () => {
    const investors = version.inputs.distributionInvestorsPct ?? 40;
    const founders = version.inputs.distributionFoundersPct ?? 30;
    const reinvest = version.inputs.distributionReinvestmentPct ?? 30;
    const total = investors + founders + reinvest;

    const sliders: { key: "distributionInvestorsPct" | "distributionFoundersPct" | "distributionReinvestmentPct"; label: string; value: number; color: string; rangeClass: string; thumbClass: string }[] = [
      { key: "distributionInvestorsPct", label: "Investors", value: investors, color: "text-success", rangeClass: "bg-success", thumbClass: "border-success" },
      { key: "distributionFoundersPct", label: "Founders", value: founders, color: "text-primary", rangeClass: "bg-primary", thumbClass: "border-primary" },
      { key: "distributionReinvestmentPct", label: "Reinvestment", value: reinvest, color: "text-warning", rangeClass: "bg-warning", thumbClass: "border-warning" },
    ];

    return (
      <div className="space-y-6">
        <div className="bg-card border rounded-2xl p-7 relative">
          <div className="flex items-center gap-3 mb-1">
            <PieChart className="h-5 w-5 text-primary" />
            <h2 className="font-bold text-lg">Distribution Policy</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-6 ml-8">How annual EBITDA is distributed among stakeholders</p>

          {total !== 100 && (
            <div className="absolute top-6 right-7 flex items-center gap-1.5 bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              <span className="text-xs font-medium text-destructive">
                Total is {total}% — must equal 100%
              </span>
            </div>
          )}

          <div className="space-y-6">
            {sliders.map((s) => (
              <div key={s.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className={cn("text-sm font-semibold", s.color)}>{s.label}</Label>
                  <span className={cn("text-lg font-bold tabular-nums", s.color)}>{s.value}%</span>
                </div>
                <Slider
                  value={[s.value]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={([v]) => handleDistributionChange(s.key, v)}
                  className="py-1"
                  rangeClassName={s.rangeClass}
                  thumbClassName={s.thumbClass}
                />
              </div>
            ))}

            <div className="flex items-center justify-between pt-4 border-t">
              <span className="text-sm font-semibold">Total</span>
              <span className={cn(
                "text-lg font-bold tabular-nums",
                total === 100 ? "text-success" : "text-destructive"
              )}>
                {total}%
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const categoryFields = activeCategory !== "policies"
    ? CATEGORY_FIELDS[activeCategory].filter((f) => !KEY_DRIVER_KEYS.has(f.key))
    : [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-full mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center gap-3 md:gap-4 flex-wrap">
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => navigate(`/project/${project.id}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base md:text-lg font-bold truncate">{project.name}</h1>
            <p className="text-xs md:text-sm text-muted-foreground">Editing: {version.name}</p>
          </div>
          <div className="flex items-center gap-1.5 bg-muted/50 rounded-xl px-2 py-1">
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={currency} onValueChange={(v) => handleCurrencyChange(v as CurrencyCode)}>
              <SelectTrigger className="border-0 bg-transparent h-auto p-0 shadow-none text-xs font-medium min-w-[60px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCY_OPTIONS.map((code) => (
                  <SelectItem key={code} value={code}>
                    {CURRENCIES[code].symbol} {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 rounded-xl"
            onClick={() => duplicateVersion(project.id, version.id)}
          >
            <Copy className="h-4 w-4" /> <span className="hidden sm:inline">Duplicate</span>
          </Button>
          <Button
            size="sm"
            className="gap-2 rounded-xl"
            onClick={() => navigate(`/project/${project.id}`)}
          >
            <Save className="h-4 w-4" /> <span className="hidden sm:inline">Save & Back</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 rounded-xl lg:hidden" onClick={() => setKeyDriversOpen(true)}>
            <SlidersHorizontal className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Drivers</span>
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8 flex gap-4 md:gap-8 animate-fade-in">
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

            <div className="flex-1 min-w-0 space-y-8">
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

              {activeCategory === "policies" ? (
                renderPoliciesTab()
              ) : (
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

                  {/* Detailed Costs sub-dialog inside Operating Costs */}
                  {activeCategory === "operatingCosts" && (
                    <div className="mt-6 pt-6 border-t">
                      <Dialog open={detailedCostsOpen} onOpenChange={setDetailedCostsOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="gap-2 rounded-xl">
                            <Eye className="h-4 w-4" /> View Detailed Costs
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Detailed Cost Breakdown</DialogTitle>
                          </DialogHeader>
                          <p className="text-sm text-muted-foreground mb-4">Structured fixed & variable costs per court-hour</p>
                          <div className="grid gap-6 sm:grid-cols-2">
                            {DETAILED_COST_FIELDS(sym).map(renderField)}
                          </div>
                        </DialogContent>
                      </Dialog>
                      <p className="text-xs text-muted-foreground mt-2">View and edit per-hour cost breakdown used in detailed cost mode</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <KeyDriversPanel
          inputs={version.inputs}
          onChange={handleChange}
          currency={currency}
          className="hidden lg:flex lg:flex-col w-[300px] sticky top-0 h-screen"
        />
      </div>

      {/* Mobile Key Drivers drawer */}
      <Sheet open={keyDriversOpen} onOpenChange={setKeyDriversOpen}>
        <SheetContent side="right" className="w-[320px] sm:w-[380px] p-0 overflow-y-auto">
          <SheetHeader className="px-5 pt-5 pb-0">
            <SheetTitle>Key Drivers</SheetTitle>
          </SheetHeader>
          <KeyDriversPanel
            inputs={version.inputs}
            onChange={handleChange}
            currency={currency}
            className="flex flex-col border-0"
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function NumericInput({ value, onChange, disabled, className }: { value: number; onChange: (v: string) => void; disabled?: boolean; className?: string }) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => { setLocal(String(value)); }, [value]);
  return (
    <Input
      type="number"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => onChange(local === "" ? "0" : local)}
      disabled={disabled}
      className={className}
    />
  );
}
