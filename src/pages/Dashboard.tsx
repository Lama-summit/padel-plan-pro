import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStore } from "@/lib/store";
import {
  calculateKPIs,
  getMonthlyEvolution,
  formatSafePct,
  formatSafeYears,
  isSafeValid,
  calculateScenarioDelta,
  calculateScenarioComparison,
  calculateSensitivityRanking,
  generateInsight,
  getValidationWarnings,
} from "@/lib/calculations";
import { Scenario, ProjectInputs, DEFAULT_INPUTS, CostMode } from "@/lib/types";
import { KPICard } from "@/components/KPICard";
import { DashboardCharts } from "@/components/DashboardCharts";
import { KeyDriversPanel } from "@/components/KeyDriversPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Plus,
  Settings,
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  Target,
  Clock,
  BarChart3,
  GitBranch,
  AlertTriangle,
  Info,
  Lightbulb,
  Zap,
  Columns,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SCENARIOS: { value: Scenario; label: string; color: string }[] = [
  { value: "base", label: "Base", color: "data-[active=true]:bg-primary data-[active=true]:text-primary-foreground" },
  { value: "optimistic", label: "Optimistic", color: "data-[active=true]:bg-success data-[active=true]:text-success-foreground" },
  { value: "pessimistic", label: "Pessimistic", color: "data-[active=true]:bg-warning data-[active=true]:text-warning-foreground" },
];

export default function Dashboard() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { getProject, setActiveVersion, createVersion: createVersionFn, updateVersionInputs } = useStore();
  const [scenario, setScenario] = useState<Scenario>("base");
  const [newVersionName, setNewVersionName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [compareMode, setCompareMode] = useState(false);

  const project = getProject(projectId!);
  const activeVersion = useMemo(
    () => project?.versions.find((v) => v.id === project.activeVersionId) || project?.versions[0],
    [project]
  );
  const kpis = useMemo(
    () => activeVersion ? calculateKPIs(activeVersion.inputs, scenario) : null,
    [activeVersion, scenario]
  );
  const monthlyData = useMemo(
    () => activeVersion ? getMonthlyEvolution(activeVersion.inputs, scenario) : [],
    [activeVersion, scenario]
  );
  const scenarioDelta = useMemo(
    () => activeVersion ? calculateScenarioDelta(activeVersion.inputs, scenario) : null,
    [activeVersion, scenario]
  );
  const comparison = useMemo(
    () => activeVersion && compareMode && scenario !== "base" ? calculateScenarioComparison(activeVersion.inputs, scenario) : null,
    [activeVersion, scenario, compareMode]
  );
  const sensitivity = useMemo(
    () => activeVersion ? calculateSensitivityRanking(activeVersion.inputs, scenario) : [],
    [activeVersion, scenario]
  );
  const insight = useMemo(
    () => kpis && activeVersion ? generateInsight(kpis, activeVersion.inputs) : "",
    [kpis, activeVersion]
  );
  const warnings = useMemo(
    () => kpis ? getValidationWarnings(kpis) : [],
    [kpis]
  );

  if (!project || !activeVersion || !kpis) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  const handleNewVersion = () => {
    if (!newVersionName.trim()) return;
    createVersionFn(project.id, newVersionName);
    setDialogOpen(false);
    setNewVersionName("");
  };

  const handleDriverChange = (key: keyof ProjectInputs, value: string | number) => {
    const numVal = key === "courtType" || key === "costMode" ? value as any : typeof value === "number" ? value : parseFloat(value) || 0;
    updateVersionInputs(project.id, activeVersion.id, { [key]: numVal });
  };

  const handleReset = () => {
    const driverKeys: (keyof ProjectInputs)[] = [
      "numberOfCourts", "openingHoursPerDay", "courtType",
      "offPeakPrice", "peakPrice", "offPeakOccupancy", "peakOccupancy",
    ];
    const resetValues: Partial<ProjectInputs> = {};
    for (const k of driverKeys) {
      (resetValues as any)[k] = DEFAULT_INPUTS[k];
    }
    updateVersionInputs(project.id, activeVersion.id, resetValues);
  };

  const formatCurrency = (val: number) => {
    if (val >= 1_000_000) return `€${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `€${(val / 1_000).toFixed(0)}K`;
    return `€${val.toFixed(0)}`;
  };

  const marginVal = isSafeValid(kpis.ebitdaMargin) ? kpis.ebitdaMargin.value! : null;

  // Break-even combined card
  const beValid = isSafeValid(kpis.breakEvenOccupancy);
  const beVal = beValid ? kpis.breakEvenOccupancy.value! : 0;
  const occAbove = beValid && kpis.weightedOccupancy >= beVal;
  const occNear = beValid && !occAbove && kpis.weightedOccupancy >= beVal * 0.9;

  // Scenario delta formatting
  const fmtDelta = (v: number | null, suffix = "%") => {
    if (v === null) return null;
    const sign = v >= 0 ? "+" : "";
    return `${sign}${v.toFixed(1)}${suffix}`;
  };

  const costMode = activeVersion.inputs.costMode || "basic";

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="border-b bg-card sticky top-0 z-10">
          <div className="max-w-full mx-auto px-6 py-4">
            <div className="flex items-center gap-4 mb-4">
              <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => navigate("/")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold tracking-tight">{project.name}</h1>
                <p className="text-sm text-muted-foreground">{project.location}</p>
              </div>
              <Button variant="outline" size="sm" className="gap-2 rounded-xl"
                onClick={() => navigate(`/project/${project.id}/inputs`)}>
                <Settings className="h-4 w-4" /> All Inputs
              </Button>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-1.5">
                <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                <Select value={activeVersion.id} onValueChange={(v) => setActiveVersion(project.id, v)}>
                  <SelectTrigger className="border-0 bg-transparent h-auto p-0 shadow-none text-sm font-medium min-w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {project.versions.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        <div className="flex flex-col">
                          <span>{v.name}</span>
                          <span className="text-xs text-muted-foreground">{new Date(v.createdAt).toLocaleDateString()}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5 rounded-xl"><Plus className="h-3.5 w-3.5" /> New Version</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New Version</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>Version Name</Label>
                      <Input placeholder="e.g. V2 - Expanded" value={newVersionName}
                        onChange={(e) => setNewVersionName(e.target.value)} />
                    </div>
                    <Button className="w-full rounded-xl" onClick={handleNewVersion}>Create</Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Cost mode toggle */}
              <div className="flex bg-muted rounded-xl p-0.5 gap-0.5">
                {(["basic", "detailed"] as CostMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => handleDriverChange("costMode", mode)}
                    className={cn(
                      "px-3 py-1 text-xs rounded-lg transition-all font-medium capitalize",
                      costMode === mode ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {mode === "basic" ? "Basic Costs" : "Detailed Costs"}
                  </button>
                ))}
              </div>

              {/* Scenario switcher + compare toggle */}
              <div className="ml-auto flex items-center gap-3">
                {scenario !== "base" && (
                  <Button
                    variant={compareMode ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5 rounded-xl text-xs h-8"
                    onClick={() => setCompareMode(!compareMode)}
                  >
                    <Columns className="h-3.5 w-3.5" /> {compareMode ? "Comparing" : "Compare vs Base"}
                  </Button>
                )}
                {scenario !== "base" && scenarioDelta && !compareMode && (
                  <Badge variant="outline" className="text-xs gap-1 py-1">
                    vs Base: EBITDA {fmtDelta(scenarioDelta.ebitdaPctChange)}
                    {scenarioDelta.paybackDelta !== null && ` · Payback ${fmtDelta(scenarioDelta.paybackDelta, "yr")}`}
                  </Badge>
                )}
                <div className="flex bg-muted rounded-xl p-1 gap-0.5">
                  {SCENARIOS.map((s) => (
                    <button
                      key={s.value}
                      data-active={scenario === s.value}
                      onClick={() => { setScenario(s.value); if (s.value === "base") setCompareMode(false); }}
                      className={`px-4 py-1.5 text-sm rounded-lg transition-all font-medium text-muted-foreground hover:text-foreground ${s.color}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-y-auto px-6 py-8">
            <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">

              {/* Validation warnings */}
              {warnings.length > 0 && (
                <div className="space-y-2">
                  {warnings.map((w) => (
                    <div key={w.id} className={cn(
                      "flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm font-medium",
                      w.severity === "error" ? "bg-destructive/5 border-destructive/20 text-destructive" : "bg-warning/5 border-warning/20 text-warning"
                    )}>
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      {w.message}
                    </div>
                  ))}
                </div>
              )}

              {/* Scenario comparison mode */}
              {compareMode && comparison && (
                <div className="bg-card border rounded-2xl p-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">Scenario Comparison — {scenario} vs Base</p>
                  <div className="grid gap-4 sm:grid-cols-4">
                    <ComparisonKPI label="Revenue" base={formatCurrency(comparison.base.totalRevenueYear)} current={formatCurrency(comparison.current.totalRevenueYear)} delta={comparison.revenueDelta} formatDelta={formatCurrency} />
                    <ComparisonKPI label="EBITDA" base={formatCurrency(comparison.base.ebitdaYear)} current={formatCurrency(comparison.current.ebitdaYear)} delta={comparison.ebitdaDelta} formatDelta={formatCurrency} />
                    <ComparisonKPI label="Payback" base={formatSafeYears(comparison.base.paybackYears)} current={formatSafeYears(comparison.current.paybackYears)} delta={comparison.paybackDelta} formatDelta={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}yr`} invertColor />
                    <ComparisonKPI label="ROI" base={isSafeValid(comparison.base.roi) ? `${comparison.base.roi.value!.toFixed(1)}%` : "—"} current={isSafeValid(comparison.current.roi) ? `${comparison.current.roi.value!.toFixed(1)}%` : "—"} delta={comparison.roiDelta} formatDelta={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`} />
                  </div>
                </div>
              )}

              {/* PRIMARY KPIs */}
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Primary Metrics</p>
              <div className="grid gap-5 md:grid-cols-2">
                {/* Annual EBITDA */}
                <div className="bg-card border rounded-2xl p-7 card-hover relative overflow-hidden">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${kpis.ebitdaYear >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                      <BarChart3 className="h-6 w-6" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Tooltip>
                        <TooltipTrigger><Info className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                        <TooltipContent>
                          <div className="text-xs space-y-1 max-w-[240px]">
                            <p className="font-medium">EBITDA = Revenue − Fixed Costs − Variable Costs</p>
                            <p>Monthly revenue: {formatCurrency(kpis.totalRevenueMonth)}</p>
                            <p>Fixed costs: {formatCurrency(kpis.costBreakdown.fixedCosts)}/mo</p>
                            <p>Variable costs: {formatCurrency(kpis.costBreakdown.variableCosts)}/mo</p>
                            <p className="text-muted-foreground">Mode: {costMode}</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1.5 font-medium">Annual EBITDA</p>
                  <p className={`text-4xl font-bold tracking-tight leading-none ${kpis.ebitdaYear >= 0 ? "text-success" : "text-destructive"}`}>
                    {kpis.totalRevenueMonth === 0 ? "Set pricing to calculate" : formatCurrency(kpis.ebitdaYear)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {kpis.totalRevenueMonth > 0
                      ? `${marginVal !== null ? `${marginVal.toFixed(0)}% margin · ` : ""}${kpis.ebitdaYear >= 0 ? "Profitable" : "Loss-making"}`
                      : "Complete capacity and pricing inputs"}
                  </p>
                  {scenarioDelta && scenarioDelta.ebitdaPctChange !== null && (
                    <p className={`text-[10px] font-medium mt-1 ${scenarioDelta.ebitdaPctChange >= 0 ? "text-success" : "text-destructive"}`}>
                      {fmtDelta(scenarioDelta.ebitdaPctChange)} vs Base
                    </p>
                  )}
                </div>

                {/* Payback Period */}
                <div className="bg-card border rounded-2xl p-7 card-hover relative overflow-hidden">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                      isSafeValid(kpis.paybackYears)
                        ? kpis.paybackYears.value! <= 5 ? "bg-success/10 text-success" : kpis.paybackYears.value! <= 8 ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      <Clock className="h-6 w-6" />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1.5 font-medium">Payback Period</p>
                  <p className={`text-4xl font-bold tracking-tight leading-none ${
                    isSafeValid(kpis.paybackYears)
                      ? kpis.paybackYears.value! <= 5 ? "text-success" : kpis.paybackYears.value! <= 8 ? "text-warning" : "text-destructive"
                      : "text-muted-foreground"
                  }`}>
                    {kpis.ebitdaYear <= 0 ? "Not profitable yet" : formatSafeYears(kpis.paybackYears)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {isSafeValid(kpis.paybackYears)
                      ? `Net cashflow ${formatCurrency(kpis.netCashflowYear)}/yr`
                      : kpis.totalInvestment === 0 ? "Set investment amount" : "Increase revenue or reduce costs"}
                  </p>
                  {scenarioDelta && scenarioDelta.paybackDelta !== null && (
                    <p className={`text-[10px] font-medium mt-1 ${scenarioDelta.paybackDelta <= 0 ? "text-success" : "text-destructive"}`}>
                      {fmtDelta(scenarioDelta.paybackDelta, " yr")} vs Base
                    </p>
                  )}
                </div>
              </div>

              {/* SECONDARY KPIs — smaller */}
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Secondary Metrics</p>
              <div className="grid gap-4 md:grid-cols-3">
                <KPICard
                  label="Annual Revenue"
                  value={kpis.totalRevenueMonth === 0 ? "Set pricing" : formatCurrency(kpis.totalRevenueYear)}
                  icon={TrendingUp}
                  variant="accent"
                  subtitle={kpis.totalRevenueMonth > 0 ? `${formatCurrency(kpis.totalRevenueMonth)}/month` : "Configure courts and pricing"}
                />
                <KPICard
                  label="Return on Investment"
                  value={isSafeValid(kpis.roi) ? `${kpis.roi.value!.toFixed(1)}%` : "—"}
                  icon={PieChart}
                  variant={isSafeValid(kpis.roi) ? (kpis.roi.value! >= 15 ? "success" : kpis.roi.value! >= 0 ? "warning" : "destructive") : "default"}
                  subtitle={isSafeValid(kpis.roi) ? `Annual · ${kpis.roi.value! >= 15 ? "Strong" : kpis.roi.value! >= 0 ? "Moderate" : "Negative"}` : "Set investment to calculate"}
                />

                {/* Operational Efficiency — combined card */}
                <div className="bg-card border rounded-2xl p-5 card-hover relative overflow-hidden">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${
                      !beValid ? "bg-muted text-muted-foreground" : occAbove ? "bg-success/10 text-success" : occNear ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"
                    }`}>
                      <Target className="h-4 w-4" />
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] py-0.5 ${
                        !beValid ? "text-muted-foreground border-border" : occAbove ? "text-success border-success/30" : occNear ? "text-warning border-warning/30" : "text-destructive border-destructive/30"
                      }`}
                    >
                      {!beValid ? "Incomplete" : occAbove ? "Above threshold" : occNear ? "Near threshold" : "Below threshold"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1 font-medium">Operational Efficiency</p>
                  {beValid ? (
                    <div className="space-y-1">
                      <div className="flex items-baseline justify-between">
                        <span className="text-[11px] text-muted-foreground">Break-even</span>
                        <span className="text-base font-bold tabular-nums">{beVal.toFixed(0)}%</span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-[11px] text-muted-foreground">Current</span>
                        <span className={`text-base font-bold tabular-nums ${occAbove ? "text-success" : occNear ? "text-warning" : "text-destructive"}`}>
                          {kpis.weightedOccupancy.toFixed(0)}%
                        </span>
                      </div>
                      <div className="relative h-1.5 bg-muted rounded-full mt-1.5 overflow-hidden">
                        <div className="absolute inset-y-0 left-0 bg-accent/30 rounded-full" style={{ width: `${Math.min(100, beVal)}%` }} />
                        <div
                          className={`absolute inset-y-0 left-0 rounded-full ${occAbove ? "bg-success" : occNear ? "bg-warning" : "bg-destructive"}`}
                          style={{ width: `${Math.min(100, kpis.weightedOccupancy)}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">Set pricing and capacity inputs</p>
                  )}
                </div>
              </div>

              {/* Insight + Sensitivity row */}
              <div className="grid gap-4 md:grid-cols-2">
                {/* Decision Insight */}
                <div className="bg-card border rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="h-4 w-4 text-warning" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-foreground">Key Insight</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{insight}</p>
                </div>

                {/* Sensitivity Ranking */}
                <div className="bg-card border rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-4 w-4 text-accent-foreground" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-foreground">Top Drivers by Impact</span>
                  </div>
                  <div className="space-y-2">
                    {sensitivity.map((s, i) => (
                      <div key={s.key} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                        <span className="text-sm text-foreground flex-1">{s.label}</span>
                        <span className={cn("text-xs font-semibold tabular-nums", s.ebitdaImpact > 0 ? "text-success" : "text-muted-foreground")}>
                          {s.ebitdaImpact >= 1000 ? `€${(s.ebitdaImpact / 1000).toFixed(0)}K` : `€${s.ebitdaImpact.toFixed(0)}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Charts */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-5">Financial Overview</p>
                <DashboardCharts monthlyData={monthlyData} kpis={kpis} />
              </div>
            </div>
          </main>

          {/* Right-side Key Drivers Panel */}
          <KeyDriversPanel
            inputs={activeVersion.inputs}
            onChange={handleDriverChange}
            onReset={handleReset}
            scenario={scenario}
            collapsed={panelCollapsed}
            onToggle={() => setPanelCollapsed((p) => !p)}
            className="hidden lg:flex lg:flex-col sticky top-0 h-screen"
          />
        </div>
      </div>
    </TooltipProvider>
  );
}

/* ─── Comparison KPI sub-component ────────────────────────── */
function ComparisonKPI({ label, base, current, delta, formatDelta, invertColor }: {
  label: string; base: string; current: string; delta: number | null;
  formatDelta: (v: number) => string; invertColor?: boolean;
}) {
  const positive = delta !== null && (invertColor ? delta < 0 : delta > 0);
  const negative = delta !== null && (invertColor ? delta > 0 : delta < 0);

  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-xs text-muted-foreground line-through">{base}</span>
        <span className="text-sm font-bold">{current}</span>
      </div>
      {delta !== null && (
        <span className={cn("text-[10px] font-semibold inline-flex items-center gap-0.5",
          positive ? "text-success" : negative ? "text-destructive" : "text-muted-foreground"
        )}>
          {positive ? <TrendingUp className="h-2.5 w-2.5" /> : negative ? <TrendingDown className="h-2.5 w-2.5" /> : null}
          {formatDelta(delta)}
        </span>
      )}
    </div>
  );
}
