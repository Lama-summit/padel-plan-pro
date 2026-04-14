import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStore } from "@/lib/store";
import {
  calculateKPIs, getMonthlyEvolution, formatSafeYears, isSafeValid,
  calculateScenarioDelta, calculateScenarioComparison, calculateSensitivityRanking,
  generateInsight, generateStructuredInsight, getInvestmentVerdict, getModelConfidence,
  calculateDriverDeltas, getConsolidatedDrivers, generateRecommendedActions, calculateSensitivityMatrix,
  calculate5YearProjection, calculatePaybackCumulative, calculateCumulativeROI, generateHighlights,
  ExportData,
} from "@/lib/calculations";
import { Scenario, ProjectInputs, DEFAULT_INPUTS, RevenueLineItem } from "@/lib/types";
import { formatCurrency, formatCurrencyAxis, formatCurrencyFull, getCurrencySymbol, CURRENCIES, CURRENCY_OPTIONS, CurrencyCode } from "@/lib/currency";
import { KPICard } from "@/components/KPICard";
import { DashboardCharts } from "@/components/DashboardCharts";
import { KeyDriversPanel } from "@/components/KeyDriversPanel";
import { InvestmentTab } from "@/components/InvestmentTab";
import { ROIAnalysisTab } from "@/components/ROIAnalysisTab";
import { RevenueModelTab } from "@/components/RevenueModelTab";
import { SensitivityMatrix } from "@/components/SensitivityMatrix";
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
  ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";

const SCENARIOS: { value: Scenario; label: string; color: string }[] = [
  { value: "base", label: "Realista", color: "data-[active=true]:bg-primary data-[active=true]:text-primary-foreground" },
  { value: "optimistic", label: "Optimistic", color: "data-[active=true]:bg-success data-[active=true]:text-success-foreground" },
  { value: "pessimistic", label: "Conservative", color: "data-[active=true]:bg-warning data-[active=true]:text-warning-foreground" },
];

type DashboardTab = "summary" | "investment" | "revenue" | "roi" | "sensitivity";

export default function Dashboard() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { getProject, setActiveVersion, createVersionFromCurrent, saveVersion, updateVersionInputs, updateProject } = useStore();
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

  const currency = (project?.currency ?? "EUR") as CurrencyCode;
  const sym = getCurrencySymbol(currency);
  const fmt = (val: number) => formatCurrency(val, currency);
  const fmtAxis = (val: number) => formatCurrencyAxis(val, currency);
  const fmtFull = (val: number) => formatCurrencyFull(val, currency);

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

  const handleDriverChange = (key: keyof ProjectInputs, value: string | number | boolean | RevenueLineItem[]) => {
    if (isReadOnly) return;
    const BOOL_KEYS: (keyof ProjectInputs)[] = ["coachingEnabled", "tournamentsEnabled", "otherRevenueEnabled"];
    let numVal = Array.isArray(value)
      ? value
      : BOOL_KEYS.includes(key)
        ? value
        : key === "courtType" || key === "costMode"
          ? value as any
          : typeof value === "number"
            ? value
            : parseFloat(value as string) || 0;

    if (key === "offPeakOccupancy" || key === "peakOccupancy") {
      numVal = Math.min(90, Math.max(10, numVal as number));
    }

    const patch: Partial<ProjectInputs> = { [key]: numVal };
    const next = { ...activeVersion.inputs, ...patch };

    const INVEST_KEYS: (keyof ProjectInputs)[] = ["courtConstructionCost", "facilityBuildout", "equipmentCost", "numberOfCourts"];
    const OPEX_KEYS: (keyof ProjectInputs)[] = ["staffCosts", "utilitiesCosts", "maintenanceCosts", "rentOrMortgage", "marketingCosts", "insuranceCosts"];
    if (INVEST_KEYS.includes(key)) {
      patch.initialInvestment = (next.courtConstructionCost * next.numberOfCourts) + next.facilityBuildout + next.equipmentCost;
    }
    if (OPEX_KEYS.includes(key)) {
      patch.monthlyOperatingCosts = OPEX_KEYS.reduce((sum, k) => sum + (next[k] as number || 0), 0);
    }
    if (key === "otherRevenueItems" && Array.isArray(numVal)) {
      patch.otherMonthlyRevenue = numVal.reduce((sum, item) => sum + ((item.monthlyRevenue || 0) - (item.monthlyCost || 0)), 0);
    }

    updateVersionInputs(project.id, activeVersion.id, patch);
  };

  const handleReset = () => {
    if (isReadOnly) return;
    const driverKeys: (keyof ProjectInputs)[] = ["numberOfCourts", "openingHoursPerDay", "offPeakPrice", "peakPrice", "offPeakOccupancy", "peakOccupancy", "coachingEnabled", "coachingHoursPerDay", "coachingPricePerHour", "coachingCostShare"];
    const resetValues: Partial<ProjectInputs> = {};
    for (const k of driverKeys) (resetValues as any)[k] = DEFAULT_INPUTS[k];
    updateVersionInputs(project.id, activeVersion.id, resetValues);
  };

  const handleCurrencyChange = (newCurrency: CurrencyCode) => {
    updateProject(project.id, { currency: newCurrency });
  };

  const handleExport = () => {
    if (!verdict || !confidence) return;
    const data: ExportData = {
      projectName: project.name, location: project.location, versionName: activeVersion.name,
      scenario, date: new Date().toLocaleDateString(), kpis, verdict, confidence, insight, sensitivity, inputs: activeVersion.inputs,
      currency,
    };
    downloadExport(data);
  };

  const marginVal = isSafeValid(kpis.ebitdaMargin) ? kpis.ebitdaMargin.value! : null;
  const beValid = isSafeValid(kpis.breakEvenOccupancy);
  const beVal = beValid ? kpis.breakEvenOccupancy.value! : 0;
  const occAbove = beValid && kpis.weightedOccupancy >= beVal;
  const fmtDelta = (v: number | null, suffix = "%") => { if (v === null) return null; const sign = v >= 0 ? "+" : ""; return `${sign}${v.toFixed(1)}${suffix}`; };

  const verdictColors = { strong: "text-success border-success/30 bg-success/5", moderate: "text-warning border-warning/30 bg-warning/5", weak: "text-destructive border-destructive/30 bg-destructive/5", incomplete: "text-muted-foreground border-border bg-muted/30" };
  const verdictIconColors = { strong: "bg-success/10 text-success", moderate: "bg-warning/10 text-warning", weak: "bg-destructive/10 text-destructive", incomplete: "bg-muted text-muted-foreground" };
  const confColors = { high: "text-success", medium: "text-warning", low: "text-destructive" };

  const baseOccPeak = activeVersion.inputs.peakOccupancy;
  const baseOccOff = activeVersion.inputs.offPeakOccupancy;
  const derivedInfo = scenario !== "base" ? {
    peakOcc: Math.min(100, Math.max(0, baseOccPeak + (scenario === "optimistic" ? 10 : -10))),
    offPeakOcc: Math.min(100, Math.max(0, baseOccOff + (scenario === "optimistic" ? 10 : -10))),
  } : null;

  return (
    <TooltipProvider>
      <div className="h-screen bg-background flex flex-col overflow-hidden">
        <header className="border-b bg-card flex-shrink-0 z-10">
          <div className="w-full px-8 pt-4 pb-2">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8 flex-shrink-0" onClick={() => navigate("/")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-base font-bold tracking-tight truncate">{project.name}</h1>
                <p className="text-xs text-muted-foreground">{project.location}</p>
              </div>
              {/* Currency selector in header */}
              <div className="ml-auto flex items-center gap-1.5 bg-muted/50 rounded-xl px-2 py-1">
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
            </div>
          </div>

          <div className="w-full px-8 pb-3">
            <div className="flex items-center gap-6">
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

          <div className="bg-muted/40 px-8 pt-2 pb-0 relative">
            <div className="flex items-end gap-1.5">
              {([
                { value: "summary", label: "Executive Summary" },
                { value: "investment", label: "Investment" },
                { value: "revenue", label: "Revenues" },
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
        </header>

        {isReadOnly && derivedInfo && (
          <div className="bg-muted/40 border-b px-8 py-2 flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
            <Info className="h-3.5 w-3.5 flex-shrink-0" />
            <span>
              Derived from Realista — Occupancy {scenario === "optimistic" ? "+10" : "−10"} pp · Pricing {scenario === "optimistic" ? "+5" : "−5"}% · OPEX {scenario === "optimistic" ? "−5" : "+5"}% · CAPEX {scenario === "optimistic" ? "−5" : "+10"}%
            </span>
            {scenarioDelta && scenarioDelta.ebitdaPctChange !== null && (
              <Badge variant="outline" className="ml-auto text-[10px] py-0">
                EBITDA {fmtDelta(scenarioDelta.ebitdaPctChange)} vs Realista
              </Badge>
            )}
          </div>
        )}

        <div className="flex flex-1 min-h-0">
          <main className="flex-1 overflow-y-auto">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DashboardTab)} className="flex flex-col flex-1">

              <div className="px-8 py-6 max-w-6xl mx-auto w-full">

                {/* ═══ EXECUTIVE SUMMARY TAB ═══ */}
                <TabsContent value="summary" className="mt-0 space-y-6 animate-fade-in">

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                    {/* CAPEX — dato neutro → azul corporativo */}
                    <div className="bg-card border rounded-xl p-5">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Total CAPEX</p>
                      <p className="text-2xl font-extrabold tabular-nums text-primary">{fmt(kpis.totalInvestment)}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Debt: {fmt(kpis.loanAmount)}</p>
                    </div>
                    {/* EBITDA — beneficio/pérdida → verde/rojo */}
                    <div className="bg-card border rounded-xl p-5">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Year 1 EBITDA</p>
                      <p className={cn("text-2xl font-extrabold tabular-nums", kpis.ebitdaYear >= 0 ? "text-success" : "text-destructive")}>{fmt(kpis.ebitdaYear)}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{marginVal !== null ? `${marginVal.toFixed(0)}% margin` : "—"}</p>
                    </div>
                    {/* Payback — beneficio si bueno, naranja si límite, rojo si malo */}
                    <div className="bg-card border rounded-xl p-5">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Payback</p>
                      <p className={cn("text-2xl font-extrabold tabular-nums",
                        cumulativePayback !== null && cumulativePayback <= 3 ? "text-success" :
                        cumulativePayback !== null && cumulativePayback <= 5 ? "text-warning" : "text-destructive"
                      )}>
                        {cumulativePayback !== null
                          ? cumulativePayback < 1 ? "<1 year" : `${(Math.round(cumulativePayback * 2) / 2).toFixed(1)} yrs`
                          : ">5 yrs"}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">Cumulative cash flow</p>
                    </div>
                    {/* Revenue — dato neutro → azul corporativo */}
                    <div className="bg-card border rounded-xl p-5">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Year 1 Revenue</p>
                      <p className="text-2xl font-extrabold tabular-nums text-primary">{fmt(kpis.totalRevenueYear)}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{fmt(kpis.totalRevenueMonth)}/mo avg</p>
                    </div>
                    {/* Break-even — siempre naranja (umbral/límite) */}
                    <div className="bg-card border rounded-xl p-5">
                      <div className="flex items-center gap-1">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Break-even Occ.</p>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground/60 -mt-1 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[220px] text-[11px] leading-snug">
                            Occupancy needed so Year 1 revenue covers the full initial investment plus all operating costs
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="text-2xl font-extrabold tabular-nums text-warning">
                        {beValid ? `${beVal.toFixed(0)}%` : "—"}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">Current: {kpis.weightedOccupancy.toFixed(0)}%</p>
                    </div>
                    {/* ROI — beneficio → verde si bueno, naranja si medio, rojo si malo */}
                    <div className="bg-card border rounded-xl p-5">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">ROI</p>
                      <div className="flex items-baseline gap-2">
                        <p className={cn("text-2xl font-extrabold tabular-nums",
                          isSafeValid(kpis.roi) && kpis.roi.value! >= 15 ? "text-success" :
                          isSafeValid(kpis.roi) && kpis.roi.value! >= 0 ? "text-warning" : "text-destructive"
                        )}>
                          {isSafeValid(kpis.roi) ? `${kpis.roi.value!.toFixed(0)}%` : "—"}
                        </p>
                        <span className="text-[10px] text-muted-foreground">yr 1</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {cumulativeROI !== null ? `${cumulativeROI.toFixed(0)}% cum. (5yr)` : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 px-1 -mt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Year 1 OPEX</span>
                      <span className="text-xs font-semibold tabular-nums">{fmt(kpis.annualCosts)}</span>
                    </div>
                    <div className="h-3 w-px bg-border" />
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Total Year 1 Cost</span>
                      <span className="text-xs font-semibold tabular-nums">{fmt(kpis.totalInvestment + kpis.annualCosts)}</span>
                    </div>
                  </div>

                  {/* Year 1 Projection + Highlights */}
                  <div className="grid gap-5 lg:grid-cols-2">
                    <div className="bg-card border rounded-2xl p-6">
                      <div className="flex items-center justify-between mb-5">
                        <div>
                          <h3 className="font-semibold text-sm">Year 1 Projection</h3>
                          <p className="text-[11px] text-muted-foreground mt-0.5">Revenue & EBITDA</p>
                        </div>
                        {scenario !== "base" && (
                          <Badge variant="outline" className="text-[10px]">{scenario} scenario</Badge>
                        )}
                      </div>
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={fiveYearProjection.slice(0, 1)} barCategoryGap="25%">
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" vertical={false} />
                          <XAxis dataKey="year" tick={{ fontSize: 11, fill: "hsl(220 9% 46%)" }} axisLine={false} tickLine={false} />
                          <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 11, fill: "hsl(220 9% 46%)" }} axisLine={false} tickLine={false} />
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
                                      <span className="font-semibold">{fmtFull(entry.value)}</span>
                                    </div>
                                  ))}
                                </div>
                              );
                            }}
                          />
                          <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 12, fontSize: 12 }} />
                          <Bar dataKey="revenue" name="Revenue" fill="hsl(225 53% 22%)" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="ebitda" name="EBITDA" fill="hsl(152 57% 24%)" radius={[4, 4, 0, 0]} />
                          <ReferenceLine y={kpis.totalInvestment + kpis.annualCosts} stroke="hsl(353 78% 44%)" strokeDasharray="6 4" strokeWidth={2} label={{ value: `Total Cost: ${fmtFull(kpis.totalInvestment + kpis.annualCosts)}`, position: "top", fontSize: 10, fill: "hsl(353 78% 44%)", fontWeight: 600 }} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="bg-card border rounded-2xl p-6 flex flex-col">
                      <div className="flex items-center gap-2 mb-4">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <h3 className="font-semibold text-sm">Highlights</h3>
                      </div>
                      <div className="space-y-3 flex-1">
                        {highlights.map((text, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <div className="h-5 w-5 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <CheckCircle className="h-3 w-3 text-success" />
                            </div>
                            <p className="text-xs leading-relaxed text-muted-foreground">{text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Investment Verdict */}
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

                  {/* Investor Returns */}
                  <div className="bg-card border rounded-2xl p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-primary" />
                      <span className="text-xs font-semibold uppercase tracking-wide">Investor Returns</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[260px] text-[11px] leading-snug">
                          Equity-level metrics after debt service. Based on {activeVersion.inputs.debtPercentage}% debt at {activeVersion.inputs.interestRate}% over {activeVersion.inputs.loanTermYears} years.
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="bg-muted/30 rounded-xl p-5">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Equity Invested</p>
                        <p className="text-2xl font-extrabold tabular-nums text-primary">{fmt(kpis.equityInvested)}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{(100 - activeVersion.inputs.debtPercentage).toFixed(0)}% of CAPEX</p>
                      </div>
                      <div className="bg-muted/30 rounded-xl p-5">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Annual Cash Flow</p>
                        <p className={cn("text-2xl font-extrabold tabular-nums", kpis.cashFlowToEquity >= 0 ? "text-success" : "text-destructive")}>
                          {fmt(kpis.cashFlowToEquity)}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">EBITDA − Debt Service</p>
                      </div>
                      <div className="bg-muted/30 rounded-xl p-5">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">ROI on Equity</p>
                        <p className={cn("text-2xl font-extrabold tabular-nums",
                          isSafeValid(kpis.roiOnEquity) && kpis.roiOnEquity.value! >= 15 ? "text-success" :
                          isSafeValid(kpis.roiOnEquity) && kpis.roiOnEquity.value! >= 0 ? "text-warning" : "text-destructive"
                        )}>
                          {isSafeValid(kpis.roiOnEquity) ? `${kpis.roiOnEquity.value!.toFixed(0)}%` : "—"}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">Cash Flow / Equity</p>
                      </div>
                      <div className="bg-muted/30 rounded-xl p-5">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Payback (Equity)</p>
                        <p className={cn("text-2xl font-extrabold tabular-nums",
                          isSafeValid(kpis.paybackEquity) && kpis.paybackEquity.value! <= 3 ? "text-success" :
                          isSafeValid(kpis.paybackEquity) && kpis.paybackEquity.value! <= 5 ? "text-warning" : "text-destructive"
                        )}>
                          {isSafeValid(kpis.paybackEquity)
                            ? kpis.paybackEquity.value! < 1 ? "<1 year" : `${kpis.paybackEquity.value!.toFixed(1)} yrs`
                            : "N/A"}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">Equity / Cash Flow</p>
                      </div>
                    </div>

                    {(kpis.cashFlowToEquity < 0 || (isSafeValid(kpis.paybackEquity) && kpis.paybackEquity.value! > activeVersion.inputs.loanTermYears)) && (
                      <div className="space-y-2">
                        {kpis.cashFlowToEquity < 0 && (
                          <div className="flex items-center gap-2 text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
                            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="text-xs">Negative cash flow to equity — debt service exceeds EBITDA</span>
                          </div>
                        )}
                        {isSafeValid(kpis.paybackEquity) && kpis.paybackEquity.value! > activeVersion.inputs.loanTermYears && kpis.cashFlowToEquity > 0 && (
                          <div className="flex items-center gap-2 text-warning bg-warning/5 border border-warning/20 rounded-lg px-3 py-2">
                            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="text-xs">Equity payback ({kpis.paybackEquity.value!.toFixed(1)} yrs) exceeds loan term ({activeVersion.inputs.loanTermYears} yrs)</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>


                  <div className="grid gap-5 md:grid-cols-2">
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
                              {d.ebitdaImpact >= 0 ? "+" : ""}{sym}{Math.abs(d.ebitdaImpact / 1000).toFixed(0)}K EBITDA
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

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
                <TabsContent value="investment" className="mt-0">
                  <InvestmentTab
                    inputs={activeVersion.inputs}
                    kpis={kpis}
                    allScenarioKPIs={allScenarioKPIs}
                    onInputChange={handleDriverChange}
                    readOnly={isReadOnly}
                    currency={currency}
                  />
                </TabsContent>

                {/* ═══ REVENUE MODEL TAB ═══ */}
                <TabsContent value="revenue" className="mt-0">
                  <RevenueModelTab
                    inputs={activeVersion.inputs}
                    kpis={kpis}
                    onInputChange={handleDriverChange}
                    readOnly={isReadOnly}
                    currency={currency}
                  />
                </TabsContent>

                {/* ═══ ROI ANALYSIS TAB ═══ */}
                <TabsContent value="roi" className="mt-0">
                  <ROIAnalysisTab
                    inputs={activeVersion.inputs}
                    kpis={kpis}
                    scenario={scenario}
                    currency={currency}
                  />
                </TabsContent>

                {/* ═══ SENSITIVITY ANALYSIS TAB ═══ */}
                <TabsContent value="sensitivity" className="mt-0 space-y-6 animate-fade-in">
                  <div className="grid gap-5 md:grid-cols-2">
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
                                  {s.ebitdaImpact >= 1000 ? `${sym}${(s.ebitdaImpact / 1000).toFixed(0)}K` : `${sym}${s.ebitdaImpact.toFixed(0)}`}
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
                                Rev: {d.annualRevenueImpact >= 0 ? "+" : ""}{fmt(d.annualRevenueImpact)}
                              </span>
                              <span className={cn("text-xs font-medium tabular-nums", d.ebitdaImpact > 0 ? "text-success" : d.ebitdaImpact < 0 ? "text-destructive" : "text-muted-foreground")}>
                                EBITDA: {d.ebitdaImpact >= 0 ? "+" : ""}{fmt(d.ebitdaImpact)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {activeVersion && (
                    <SensitivityMatrix
                      inputs={activeVersion.inputs}
                      scenario={scenario}
                      currency={currency}
                    />
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </main>

          <KeyDriversPanel
            inputs={activeVersion.inputs} onChange={handleDriverChange} onReset={handleReset}
            scenario={scenario} collapsed={panelCollapsed} onToggle={() => setPanelCollapsed((p) => !p)}
            readOnly={isReadOnly}
            currency={currency}
            className="hidden lg:flex lg:flex-col h-full overflow-y-auto"
          />
        </div>
      </div>
    </TooltipProvider>
  );
}
