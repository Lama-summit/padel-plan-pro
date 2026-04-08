import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStore } from "@/lib/store";
import {
  calculateKPIs, getMonthlyEvolution, formatSafeYears, isSafeValid,
  calculateScenarioDelta, calculateScenarioComparison, calculateSensitivityRanking,
  generateInsight, generateStructuredInsight, getInvestmentVerdict, getModelConfidence,
  calculateDriverDeltas, getConsolidatedDrivers, generateRecommendedActions,
  calculate5YearProjection, calculatePaybackCumulative, calculateCumulativeROI, generateHighlights,
  ExportData,
} from "@/lib/calculations";
import { Scenario, ProjectInputs, DEFAULT_INPUTS } from "@/lib/types";
import { KPICard } from "@/components/KPICard";
import { DashboardCharts } from "@/components/DashboardCharts";
import { KeyDriversPanel } from "@/components/KeyDriversPanel";
import { downloadExport } from "@/lib/export";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, Plus, Settings, TrendingUp, TrendingDown, PieChart, Target, Clock,
  BarChart3, GitBranch, AlertTriangle, Info, Lightbulb, Zap, Download,
  Shield, Gauge, Save, CheckCircle, Sparkles, DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend,
} from "recharts";

const SCENARIOS: { value: Scenario; label: string; color: string }[] = [
  { value: "base", label: "Base", color: "data-[active=true]:bg-primary data-[active=true]:text-primary-foreground" },
  { value: "optimistic", label: "Optimistic", color: "data-[active=true]:bg-success data-[active=true]:text-success-foreground" },
  { value: "pessimistic", label: "Pessimistic", color: "data-[active=true]:bg-warning data-[active=true]:text-warning-foreground" },
];

type DashboardTab = "summary" | "investment" | "revenue" | "roi" | "sensitivity";

export default function Dashboard() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { getProject, setActiveVersion, createVersionFromCurrent, saveVersion, updateVersionInputs } = useStore();
  const [scenario, setScenario] = useState<Scenario>("base");
  const [newVersionName, setNewVersionName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>("summary");

  const project = getProject(projectId!);
  const activeVersion = useMemo(
    () => project?.versions.find((v) => v.id === project.activeVersionId) || project?.versions[0],
    [project]
  );

  const isReadOnly = scenario !== "base";

  const kpis = useMemo(() => activeVersion ? calculateKPIs(activeVersion.inputs, scenario) : null, [activeVersion, scenario]);
  const monthlyData = useMemo(() => activeVersion ? getMonthlyEvolution(activeVersion.inputs, scenario) : [], [activeVersion, scenario]);
  const scenarioDelta = useMemo(() => activeVersion ? calculateScenarioDelta(activeVersion.inputs, scenario) : null, [activeVersion, scenario]);
  const driverDeltas = useMemo(() => activeVersion ? calculateDriverDeltas(activeVersion.inputs, scenario) : {}, [activeVersion, scenario]);
  const sensitivity = useMemo(() => activeVersion ? calculateSensitivityRanking(activeVersion.inputs, scenario) : [], [activeVersion, scenario]);
  const insight = useMemo(() => kpis && activeVersion ? generateInsight(kpis, activeVersion.inputs, driverDeltas) : "", [kpis, activeVersion, driverDeltas]);
  const structuredInsight = useMemo(() => kpis && activeVersion ? generateStructuredInsight(kpis, activeVersion.inputs, driverDeltas) : null, [kpis, activeVersion, driverDeltas]);
  
  const verdict = useMemo(() => kpis ? getInvestmentVerdict(kpis) : null, [kpis]);
  const confidence = useMemo(() => activeVersion ? getModelConfidence(activeVersion.inputs) : null, [activeVersion]);
  const consolidatedDrivers = useMemo(() => getConsolidatedDrivers(driverDeltas), [driverDeltas]);
  const recommendedActions = useMemo(() => kpis && activeVersion && confidence ? generateRecommendedActions(kpis, activeVersion.inputs, driverDeltas, confidence) : [], [kpis, activeVersion, driverDeltas, confidence]);
  const fiveYearProjection = useMemo(() => activeVersion ? calculate5YearProjection(activeVersion.inputs, scenario) : [], [activeVersion, scenario]);
  const cumulativePayback = useMemo(() => activeVersion ? calculatePaybackCumulative(activeVersion.inputs, scenario) : null, [activeVersion, scenario]);
  const cumulativeROI = useMemo(() => activeVersion ? calculateCumulativeROI(activeVersion.inputs, scenario, 5) : null, [activeVersion, scenario]);
  const highlights = useMemo(() => kpis && activeVersion ? generateHighlights(kpis, activeVersion.inputs) : [], [kpis, activeVersion]);

  // Compute all 3 scenarios for comparison display
  const allScenarioKPIs = useMemo(() => {
    if (!activeVersion) return null;
    return {
      base: calculateKPIs(activeVersion.inputs, "base"),
      optimistic: calculateKPIs(activeVersion.inputs, "optimistic"),
      pessimistic: calculateKPIs(activeVersion.inputs, "pessimistic"),
    };
  }, [activeVersion]);

  if (!project || !activeVersion || !kpis) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Project not found</p></div>;
  }

  const handleNewVersion = () => {
    if (!newVersionName.trim()) return;
    createVersionFromCurrent(project.id, newVersionName);
    setDialogOpen(false);
    setNewVersionName("");
    toast.success("New version created");
  };

  const handleSave = () => {
    saveVersion(project.id, activeVersion.id);
    toast.success("Version saved");
  };

  const handleDriverChange = (key: keyof ProjectInputs, value: string | number) => {
    if (isReadOnly) return;
    let numVal = key === "courtType" || key === "costMode" ? value as any : typeof value === "number" ? value : parseFloat(value) || 0;

    // Clamp base occupancy so derived scenarios (±10 pp) stay within 0–100%
    if (key === "offPeakOccupancy" || key === "peakOccupancy") {
      numVal = Math.min(90, Math.max(10, numVal as number));
    }

    const patch: Partial<ProjectInputs> = { [key]: numVal };
    const next = { ...activeVersion.inputs, ...patch };

    // Auto-compute category totals
    const INVEST_KEYS: (keyof ProjectInputs)[] = ["courtConstructionCost", "facilityBuildout", "equipmentCost", "numberOfCourts"];
    const OPEX_KEYS: (keyof ProjectInputs)[] = ["staffCosts", "utilitiesCosts", "maintenanceCosts", "rentOrMortgage", "marketingCosts", "insuranceCosts"];
    const OTHER_REV_KEYS: (keyof ProjectInputs)[] = ["proshopRevenue", "fAndBRevenue", "membershipFees"];

    if (INVEST_KEYS.includes(key)) {
      patch.initialInvestment = (next.courtConstructionCost * next.numberOfCourts) + next.facilityBuildout + next.equipmentCost;
    }
    if (OPEX_KEYS.includes(key)) {
      patch.monthlyOperatingCosts = OPEX_KEYS.reduce((sum, k) => sum + (next[k] as number || 0), 0);
    }
    if (OTHER_REV_KEYS.includes(key)) {
      patch.otherMonthlyRevenue = OTHER_REV_KEYS.reduce((sum, k) => sum + (next[k] as number || 0), 0);
    }

    updateVersionInputs(project.id, activeVersion.id, patch);
  };

  const handleReset = () => {
    if (isReadOnly) return;
    const driverKeys: (keyof ProjectInputs)[] = ["numberOfCourts", "openingHoursPerDay", "courtType", "offPeakPrice", "peakPrice", "offPeakOccupancy", "peakOccupancy"];
    const resetValues: Partial<ProjectInputs> = {};
    for (const k of driverKeys) (resetValues as any)[k] = DEFAULT_INPUTS[k];
    updateVersionInputs(project.id, activeVersion.id, resetValues);
  };

  const handleExport = () => {
    if (!verdict || !confidence) return;
    const data: ExportData = {
      projectName: project.name, location: project.location, versionName: activeVersion.name,
      scenario, date: new Date().toLocaleDateString(), kpis, verdict, confidence, insight, sensitivity, inputs: activeVersion.inputs,
    };
    downloadExport(data);
  };

  const formatCurrency = (val: number) => {
    if (val >= 1_000_000) return `€${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `€${(val / 1_000).toFixed(0)}K`;
    return `€${val.toFixed(0)}`;
  };

  const marginVal = isSafeValid(kpis.ebitdaMargin) ? kpis.ebitdaMargin.value! : null;
  const beValid = isSafeValid(kpis.breakEvenOccupancy);
  const beVal = beValid ? kpis.breakEvenOccupancy.value! : 0;
  const occAbove = beValid && kpis.weightedOccupancy >= beVal;
  const fmtDelta = (v: number | null, suffix = "%") => { if (v === null) return null; const sign = v >= 0 ? "+" : ""; return `${sign}${v.toFixed(1)}${suffix}`; };

  const verdictColors = { strong: "text-success border-success/30 bg-success/5", moderate: "text-warning border-warning/30 bg-warning/5", weak: "text-destructive border-destructive/30 bg-destructive/5", incomplete: "text-muted-foreground border-border bg-muted/30" };
  const verdictIconColors = { strong: "bg-success/10 text-success", moderate: "bg-warning/10 text-warning", weak: "bg-destructive/10 text-destructive", incomplete: "bg-muted text-muted-foreground" };
  const confColors = { high: "text-success", medium: "text-warning", low: "text-destructive" };

  // Derived scenario occupancy display
  const baseOccPeak = activeVersion.inputs.peakOccupancy;
  const baseOccOff = activeVersion.inputs.offPeakOccupancy;
  const derivedInfo = scenario !== "base" ? {
    peakOcc: Math.min(100, Math.max(0, baseOccPeak + (scenario === "optimistic" ? 10 : -10))),
    offPeakOcc: Math.min(100, Math.max(0, baseOccOff + (scenario === "optimistic" ? 10 : -10))),
  } : null;

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background flex flex-col">
        {/* ─── HEADER ─── */}
        <header className="border-b bg-card sticky top-0 z-10">
          {/* Top row: project title */}
          <div className="w-full px-8 pt-4 pb-2">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8 flex-shrink-0" onClick={() => navigate("/")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-base font-bold tracking-tight truncate">{project.name}</h1>
                <p className="text-xs text-muted-foreground">{project.location}</p>
              </div>
            </div>
          </div>

          {/* Bottom row: controls */}
          <div className="w-full px-8 pb-3">
            <div className="flex items-center gap-6">
              {/* LEFT GROUP — Version management */}
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5 bg-muted/50 rounded-xl px-3 py-1.5">
                  <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                  <Select value={activeVersion.id} onValueChange={(v) => setActiveVersion(project.id, v)}>
                    <SelectTrigger className="border-0 bg-transparent h-auto p-0 shadow-none text-xs font-medium min-w-[100px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {project.versions.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          <div className="flex flex-col"><span>{v.name}</span><span className="text-xs text-muted-foreground">{new Date(v.createdAt).toLocaleDateString()}</span></div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-px h-6 bg-border" />

                <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs h-8" onClick={handleSave}>
                  <Save className="h-3.5 w-3.5" /> Save
                </Button>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1.5 rounded-xl text-xs h-8"><Plus className="h-3.5 w-3.5" /> New Version</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>New Version</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div className="space-y-2"><Label>Version Name</Label><Input placeholder="e.g. V2 - Expanded" value={newVersionName} onChange={(e) => setNewVersionName(e.target.value)} /></div>
                      <p className="text-xs text-muted-foreground">Creates a new snapshot using all current inputs.</p>
                      <Button className="w-full rounded-xl" onClick={handleNewVersion}>Create</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* CENTER — Scenario selector (visually independent) */}
              <div className="mx-auto">
                <div className="flex bg-muted rounded-xl p-0.5 gap-0.5">
                  {SCENARIOS.map((s) => (
                    <button key={s.value} data-active={scenario === s.value} onClick={() => setScenario(s.value)}
                      className={`px-4 py-1.5 text-xs rounded-lg transition-all font-medium text-muted-foreground hover:text-foreground ${s.color}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* RIGHT GROUP — Secondary actions */}
              <div className="flex items-center gap-2.5">
                <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs h-8" onClick={handleExport}>
                  <Download className="h-3.5 w-3.5" /> Export
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs h-8" onClick={() => navigate(`/project/${project.id}/inputs`)}>
                  <Settings className="h-3.5 w-3.5" /> All Inputs
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* ─── DERIVED SCENARIO BANNER ─── */}
        {isReadOnly && derivedInfo && (
          <div className="bg-muted/40 border-b px-8 py-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 flex-shrink-0" />
            <span>
              Derived from Base scenario — Occupancy adjusted by {scenario === "optimistic" ? "+10" : "−10"} pts
              (Peak: {derivedInfo.peakOcc}%, Off-Peak: {derivedInfo.offPeakOcc}%)
            </span>
            {scenarioDelta && scenarioDelta.ebitdaPctChange !== null && (
              <Badge variant="outline" className="ml-auto text-[10px] py-0">
                EBITDA {fmtDelta(scenarioDelta.ebitdaPctChange)} vs Base
              </Badge>
            )}
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {/* ─── MAIN CONTENT ─── */}
          <main className="flex-1 overflow-y-auto">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DashboardTab)} className="flex flex-col flex-1">
              {/* Tab bar — workspace folder style */}
              <div className="bg-muted/40 px-8 pt-3 pb-0 relative">
                <div className="flex items-end gap-1.5">
                  {([
                    { value: "summary", label: "Executive Summary" },
                    { value: "investment", label: "Investment" },
                    { value: "revenue", label: "Revenue Model" },
                    { value: "roi", label: "ROI Analysis" },
                    { value: "sensitivity", label: "Sensitivity Analysis" },
                  ] as { value: DashboardTab; label: string }[]).map((tab) => {
                    const isActive = activeTab === tab.value;
                    return (
                      <button
                        key={tab.value}
                        onClick={() => setActiveTab(tab.value)}
                        className={cn(
                          "relative px-5 py-2.5 text-xs font-medium transition-all rounded-t-xl",
                          isActive
                            ? "bg-background text-foreground shadow-[0_-2px_6px_rgba(0,0,0,0.05)] z-10 -mb-px"
                            : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted/90 -mb-px"
                        )}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-px bg-border" />
              </div>

              <div className="px-8 py-6 max-w-6xl mx-auto w-full">

                {/* ═══ EXECUTIVE SUMMARY TAB ═══ */}
                <TabsContent value="summary" className="mt-0 space-y-6 animate-fade-in">

                  {/* ── SECTION 1: 6 KPIs ── */}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                    {/* Primary KPIs — dominant */}
                    <div className="bg-card border-2 border-foreground/10 rounded-xl p-5">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Total CAPEX</p>
                      <p className="text-2xl font-extrabold tabular-nums">{formatCurrency(kpis.totalInvestment)}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Debt: {formatCurrency(kpis.loanAmount)}</p>
                    </div>
                    <div className="bg-card border-2 border-foreground/10 rounded-xl p-5">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Year 1 EBITDA</p>
                      <p className={cn("text-2xl font-extrabold tabular-nums", kpis.ebitdaYear >= 0 ? "text-success" : "text-destructive")}>{formatCurrency(kpis.ebitdaYear)}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{marginVal !== null ? `${marginVal.toFixed(0)}% margin` : "—"}</p>
                    </div>
                    <div className="bg-card border-2 border-foreground/10 rounded-xl p-5">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Payback</p>
                      <p className={cn("text-2xl font-extrabold tabular-nums",
                        cumulativePayback !== null && cumulativePayback <= 3 ? "text-success" :
                        cumulativePayback !== null && cumulativePayback <= 5 ? "text-warning" : "text-foreground"
                      )}>
                        {cumulativePayback !== null
                          ? cumulativePayback < 1 ? "<1 year" : `${(Math.round(cumulativePayback * 2) / 2).toFixed(1)} yrs`
                          : ">5 yrs"}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">Cumulative cash flow</p>
                    </div>

                    {/* Secondary KPIs — lighter */}
                    <div className="bg-card border rounded-xl p-4">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Year 1 Revenue</p>
                      <p className="text-lg font-bold tabular-nums text-muted-foreground">{formatCurrency(kpis.totalRevenueYear)}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{formatCurrency(kpis.totalRevenueMonth)}/mo avg</p>
                    </div>
                    <div className="bg-card border rounded-xl p-4">
                      <div className="flex items-center gap-1">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Break-even Occ.</p>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground/60 -mt-1 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[220px] text-[11px] leading-snug">
                            Occupancy required to recover initial investment (CAPEX) plus first-year operating costs (OPEX)
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <p className={cn("text-lg font-bold tabular-nums", occAbove ? "text-success" : "text-warning")}>
                        {beValid ? `${beVal.toFixed(0)}%` : "—"}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">Current: {kpis.weightedOccupancy.toFixed(0)}%</p>
                    </div>
                    <div className="bg-card border rounded-xl p-4">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">ROI</p>
                      <div className="flex items-baseline gap-2">
                        <p className={cn("text-lg font-bold tabular-nums", isSafeValid(kpis.roi) && kpis.roi.value! >= 15 ? "text-success" : "text-muted-foreground")}>
                          {isSafeValid(kpis.roi) ? `${kpis.roi.value!.toFixed(0)}%` : "—"}
                        </p>
                        <span className="text-[10px] text-muted-foreground">yr 1</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {cumulativeROI !== null ? `${cumulativeROI.toFixed(0)}% cum. (5yr)` : "—"}
                      </p>
                    </div>
                  </div>

                  {/* ── Secondary cost context ── */}
                  <div className="flex items-center gap-6 px-1 -mt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Year 1 OPEX</span>
                      <span className="text-xs font-semibold tabular-nums">{formatCurrency(kpis.annualCosts)}</span>
                    </div>
                    <div className="h-3 w-px bg-border" />
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Total Year 1 Cost</span>
                      <span className="text-xs font-semibold tabular-nums">{formatCurrency(kpis.totalInvestment + kpis.annualCosts)}</span>
                    </div>
                  </div>

                  {/* ── SECTION 2: 5-Year Projection Chart ── */}
                  <div className="bg-card border rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <h3 className="font-semibold text-sm">5-Year Projection</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Revenue & EBITDA · 5% annual growth assumed</p>
                      </div>
                      {scenario !== "base" && (
                        <Badge variant="outline" className="text-[10px]">{scenario} scenario</Badge>
                      )}
                    </div>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={fiveYearProjection} barCategoryGap="25%">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" vertical={false} />
                        <XAxis dataKey="year" tick={{ fontSize: 11, fill: "hsl(220 9% 46%)" }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={(v: number) => `€${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11, fill: "hsl(220 9% 46%)" }} axisLine={false} tickLine={false} />
                        <RechartsTooltip
                          content={({ active, payload, label }: any) => {
                            if (!active || !payload) return null;
                            return (
                              <div className="bg-card border rounded-xl px-4 py-3 shadow-xl shadow-foreground/5">
                                <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
                                {payload.map((entry: any, i: number) => (
                                  <div key={i} className="flex items-center gap-2 text-sm">
                                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                    <span className="text-muted-foreground">{entry.name}:</span>
                                    <span className="font-semibold">€{entry.value?.toLocaleString()}</span>
                                  </div>
                                ))}
                              </div>
                            );
                          }}
                        />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 12, fontSize: 12 }} />
                        <Bar dataKey="revenue" name="Revenue" fill="hsl(217 91% 60%)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="ebitda" name="EBITDA" fill="hsl(152 69% 41%)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* ── SECTION 3: Highlights ── */}
                  <div className="bg-card border rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="text-xs font-semibold uppercase tracking-wide">Highlights</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {highlights.map((h, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                          <p className="text-xs leading-relaxed">{h}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── SECTION 4: Investment Verdict (dominant) ── */}
                  {verdict && (
                    <div className={cn(
                      "border-2 rounded-2xl p-6 relative overflow-hidden",
                      verdictColors[verdict.level]
                    )}>
                      <div className="flex items-start gap-5">
                        <div className={cn(
                          "h-14 w-14 rounded-xl flex items-center justify-center flex-shrink-0",
                          verdictIconColors[verdict.level]
                        )}>
                          <Shield className="h-7 w-7" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Investment Verdict</p>
                          <p className={cn(
                            "text-2xl font-bold tracking-tight mb-1",
                            verdict.level === "strong" ? "text-success" :
                            verdict.level === "moderate" ? "text-warning" :
                            verdict.level === "weak" ? "text-destructive" :
                            "text-muted-foreground"
                          )}>{verdict.label}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed max-w-lg">{verdict.interpretation}</p>
                        </div>
                        <div className="flex-shrink-0 grid grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Payback</p>
                            <p className="text-sm font-bold tabular-nums">{verdict.metrics.payback}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Margin</p>
                            <p className="text-sm font-bold tabular-nums">{verdict.metrics.margin}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground font-medium mb-0.5">ROI</p>
                            <p className="text-sm font-bold tabular-nums">{verdict.metrics.roi}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── SECTION 5-7: Drivers | Actions | Risk ── */}
                  <div className="grid gap-5 md:grid-cols-2">
                    {/* What Drives This Business */}
                    <div className="bg-card border rounded-2xl p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="h-4 w-4 text-accent" />
                        <span className="text-xs font-semibold uppercase tracking-wide">What Drives This Business</span>
                      </div>
                      <div className="space-y-3">
                        {consolidatedDrivers.map((d, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="h-1.5 w-1.5 rounded-full bg-accent flex-shrink-0" />
                              <span className="text-xs font-medium">{d.label}</span>
                              <span className="text-[10px] text-muted-foreground">({d.unit})</span>
                            </div>
                            <span className={cn(
                              "text-xs font-bold tabular-nums flex-shrink-0",
                              d.ebitdaImpact >= 0 ? "text-success" : "text-destructive"
                            )}>
                              {d.ebitdaImpact >= 0 ? "+" : ""}€{Math.abs(d.ebitdaImpact / 1000).toFixed(0)}K EBITDA
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recommended Actions */}
                    <div className="bg-card border rounded-2xl p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <Zap className="h-4 w-4 text-warning" />
                        <span className="text-xs font-semibold uppercase tracking-wide">Recommended Actions</span>
                      </div>
                      <div className="space-y-2.5">
                        {recommendedActions.map((action, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <CheckCircle className="h-3.5 w-3.5 text-success mt-0.5 flex-shrink-0" />
                            <p className="text-xs leading-relaxed">{action}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </TabsContent>

                {/* ═══ INVESTMENT TAB ═══ */}
                <TabsContent value="investment" className="mt-0 space-y-6 animate-fade-in">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <KPICard label="Total Investment" value={formatCurrency(kpis.totalInvestment)} icon={BarChart3} variant="default"
                      subtitle={`Debt: ${formatCurrency(kpis.loanAmount)}`} />
                    <KPICard label="Payback Period" value={kpis.ebitdaYear <= 0 ? "N/A" : formatSafeYears(kpis.paybackYears)} icon={Clock}
                      variant={isSafeValid(kpis.paybackYears) ? (kpis.paybackYears.value! <= 3 ? "success" : kpis.paybackYears.value! <= 5 ? "warning" : "destructive") : "default"} />
                    <KPICard label="Monthly Loan Payment" value={formatCurrency(kpis.loanPaymentMonth)} icon={Target} variant="default"
                      subtitle={`${activeVersion.inputs.interestRate}% rate · ${activeVersion.inputs.loanTermYears}yr term`} />
                  </div>

                  {/* 3-scenario comparison table */}
                  {allScenarioKPIs && (
                    <div className="bg-card border rounded-2xl p-6">
                      <h3 className="text-sm font-semibold mb-4">Investment Returns by Scenario</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 text-xs text-muted-foreground font-medium">Metric</th>
                              <th className="text-right py-2 text-xs text-muted-foreground font-medium">Pessimistic</th>
                              <th className="text-right py-2 text-xs font-semibold">Base</th>
                              <th className="text-right py-2 text-xs text-muted-foreground font-medium">Optimistic</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            <tr>
                              <td className="py-2 text-xs text-muted-foreground">Annual EBITDA</td>
                              <td className="py-2 text-xs text-right tabular-nums">{formatCurrency(allScenarioKPIs.pessimistic.ebitdaYear)}</td>
                              <td className="py-2 text-xs text-right tabular-nums font-semibold">{formatCurrency(allScenarioKPIs.base.ebitdaYear)}</td>
                              <td className="py-2 text-xs text-right tabular-nums">{formatCurrency(allScenarioKPIs.optimistic.ebitdaYear)}</td>
                            </tr>
                            <tr>
                              <td className="py-2 text-xs text-muted-foreground">Payback</td>
                              <td className="py-2 text-xs text-right tabular-nums">{formatSafeYears(allScenarioKPIs.pessimistic.paybackYears)}</td>
                              <td className="py-2 text-xs text-right tabular-nums font-semibold">{formatSafeYears(allScenarioKPIs.base.paybackYears)}</td>
                              <td className="py-2 text-xs text-right tabular-nums">{formatSafeYears(allScenarioKPIs.optimistic.paybackYears)}</td>
                            </tr>
                            <tr>
                              <td className="py-2 text-xs text-muted-foreground">ROI</td>
                              <td className="py-2 text-xs text-right tabular-nums">{isSafeValid(allScenarioKPIs.pessimistic.roi) ? `${allScenarioKPIs.pessimistic.roi.value!.toFixed(1)}%` : "—"}</td>
                              <td className="py-2 text-xs text-right tabular-nums font-semibold">{isSafeValid(allScenarioKPIs.base.roi) ? `${allScenarioKPIs.base.roi.value!.toFixed(1)}%` : "—"}</td>
                              <td className="py-2 text-xs text-right tabular-nums">{isSafeValid(allScenarioKPIs.optimistic.roi) ? `${allScenarioKPIs.optimistic.roi.value!.toFixed(1)}%` : "—"}</td>
                            </tr>
                            <tr>
                              <td className="py-2 text-xs text-muted-foreground">Net Cashflow/yr</td>
                              <td className="py-2 text-xs text-right tabular-nums">{formatCurrency(allScenarioKPIs.pessimistic.netCashflowYear)}</td>
                              <td className="py-2 text-xs text-right tabular-nums font-semibold">{formatCurrency(allScenarioKPIs.base.netCashflowYear)}</td>
                              <td className="py-2 text-xs text-right tabular-nums">{formatCurrency(allScenarioKPIs.optimistic.netCashflowYear)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* ═══ REVENUE MODEL TAB ═══ */}
                <TabsContent value="revenue" className="mt-0 space-y-6 animate-fade-in">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <KPICard label="Annual Revenue" value={formatCurrency(kpis.totalRevenueYear)} icon={TrendingUp} variant="accent" />
                    <KPICard label="Court Revenue" value={formatCurrency(kpis.annualCourtRevenue)} icon={BarChart3} variant="default"
                      subtitle={`${kpis.totalRevenueYear > 0 ? Math.round(kpis.annualCourtRevenue / kpis.totalRevenueYear * 100) : 0}% of total`} />
                    <KPICard label="Other Revenue" value={formatCurrency(kpis.annualOtherRevenue)} icon={PieChart} variant="default" />
                    <KPICard label="Wtd. Occupancy" value={`${kpis.weightedOccupancy.toFixed(0)}%`} icon={Target}
                      variant={occAbove ? "success" : "warning"}
                      subtitle={beValid ? `Break-even: ${beVal.toFixed(0)}%` : undefined} />
                  </div>
                  <DashboardCharts monthlyData={monthlyData} kpis={kpis} />
                </TabsContent>

                {/* ═══ ROI ANALYSIS TAB ═══ */}
                <TabsContent value="roi" className="mt-0 space-y-6 animate-fade-in">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <KPICard label="Annual EBITDA" value={formatCurrency(kpis.ebitdaYear)} icon={BarChart3}
                      variant={kpis.ebitdaYear >= 0 ? "success" : "destructive"}
                      subtitle={marginVal !== null ? `${marginVal.toFixed(0)}% margin` : undefined} />
                    <KPICard label="Annual Costs" value={formatCurrency(kpis.annualCosts)} icon={TrendingDown} variant="destructive"
                      subtitle={`Fixed: ${formatCurrency(kpis.costBreakdown.fixedCosts * 12)} · Var: ${formatCurrency(kpis.costBreakdown.variableCosts * 12)}`} />
                    <KPICard label="Net Cashflow" value={formatCurrency(kpis.netCashflowYear)} icon={Target}
                      variant={kpis.netCashflowYear >= 0 ? "success" : "destructive"}
                      subtitle={`After loan: ${formatCurrency(kpis.loanPaymentMonth)}/mo`} />
                  </div>

                  {/* Cost breakdown */}
                  <div className="bg-card border rounded-2xl p-6">
                    <h3 className="text-sm font-semibold mb-4">Monthly Cost Breakdown</h3>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {[
                        { label: "Staff", value: kpis.costBreakdown.details.staff },
                        { label: "Rent", value: kpis.costBreakdown.details.rent },
                        { label: "Energy", value: kpis.costBreakdown.details.energy },
                        { label: "Maintenance", value: kpis.costBreakdown.details.maintenance },
                        { label: "Cleaning", value: kpis.costBreakdown.details.cleaning },
                        { label: "Marketing", value: kpis.costBreakdown.details.marketing },
                        { label: "Insurance", value: kpis.costBreakdown.details.insurance },
                        { label: "Software", value: kpis.costBreakdown.details.software },
                      ].filter(c => c.value > 0).map((c) => (
                        <div key={c.label} className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg">
                          <span className="text-xs text-muted-foreground">{c.label}</span>
                          <span className="text-xs font-semibold tabular-nums">{formatCurrency(c.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                {/* ═══ SENSITIVITY ANALYSIS TAB ═══ */}
                <TabsContent value="sensitivity" className="mt-0 space-y-6 animate-fade-in">
                  <div className="grid gap-5 md:grid-cols-2">
                    {/* Top Drivers */}
                    <div className="bg-card border rounded-2xl p-6">
                      <div className="flex items-center gap-2 mb-5">
                        <Zap className="h-4 w-4 text-accent-foreground" />
                        <span className="text-sm font-semibold">Top Drivers by EBITDA Impact</span>
                      </div>
                      <div className="space-y-4">
                        {sensitivity.map((s, i) => {
                          const maxImpact = sensitivity[0]?.ebitdaImpact || 1;
                          return (
                            <div key={s.key} className="space-y-1.5">
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                                <span className="text-sm flex-1">{s.label}</span>
                                <span className="text-xs font-semibold tabular-nums text-success">
                                  {s.ebitdaImpact >= 1000 ? `€${(s.ebitdaImpact / 1000).toFixed(0)}K` : `€${s.ebitdaImpact.toFixed(0)}`}
                                </span>
                              </div>
                              <div className="ml-8 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${(s.ebitdaImpact / maxImpact) * 100}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Detailed driver deltas */}
                    <div className="bg-card border rounded-2xl p-6">
                      <div className="flex items-center gap-2 mb-5">
                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-semibold">Driver Impact Detail</span>
                      </div>
                      <div className="space-y-3">
                        {Object.values(driverDeltas).map((d) => (
                          <div key={d.key} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                            <span className="text-xs text-muted-foreground">{d.label}</span>
                            <div className="flex items-center gap-3">
                              <span className={cn("text-xs font-medium tabular-nums", d.annualRevenueImpact > 0 ? "text-success" : d.annualRevenueImpact < 0 ? "text-destructive" : "text-muted-foreground")}>
                                Rev: {d.annualRevenueImpact >= 0 ? "+" : ""}{formatCurrency(d.annualRevenueImpact)}
                              </span>
                              <span className={cn("text-xs font-medium tabular-nums", d.ebitdaImpact > 0 ? "text-success" : d.ebitdaImpact < 0 ? "text-destructive" : "text-muted-foreground")}>
                                EBITDA: {d.ebitdaImpact >= 0 ? "+" : ""}{formatCurrency(d.ebitdaImpact)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </main>

          {/* ─── KEY DRIVERS PANEL ─── */}
          <KeyDriversPanel
            inputs={activeVersion.inputs} onChange={handleDriverChange} onReset={handleReset}
            scenario={scenario} collapsed={panelCollapsed} onToggle={() => setPanelCollapsed((p) => !p)}
            readOnly={isReadOnly}
            className="hidden lg:flex lg:flex-col sticky top-0 h-screen"
          />
        </div>
      </div>
    </TooltipProvider>
  );
}
