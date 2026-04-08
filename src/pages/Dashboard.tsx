import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStore } from "@/lib/store";
import {
  calculateKPIs, getMonthlyEvolution, formatSafeYears, isSafeValid,
  calculateScenarioDelta, calculateScenarioComparison, calculateSensitivityRanking,
  generateInsight, generateStructuredInsight, getValidationWarnings, getInvestmentVerdict, getModelConfidence,
  calculateDriverDeltas, ExportData,
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
  Shield, Gauge, Save, CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  const warnings = useMemo(() => kpis ? getValidationWarnings(kpis) : [], [kpis]);
  const verdict = useMemo(() => kpis ? getInvestmentVerdict(kpis) : null, [kpis]);
  const confidence = useMemo(() => activeVersion ? getModelConfidence(activeVersion.inputs) : null, [activeVersion]);

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
    const numVal = key === "courtType" || key === "costMode" ? value as any : typeof value === "number" ? value : parseFloat(value) || 0;
    updateVersionInputs(project.id, activeVersion.id, { [key]: numVal });
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
              {/* Tab bar */}
              <div className="border-b bg-card/50 px-8">
                <TabsList className="bg-transparent h-auto p-0 gap-0 rounded-none">
                  {([
                    { value: "summary", label: "Executive Summary" },
                    { value: "investment", label: "Investment" },
                    { value: "revenue", label: "Revenue Model" },
                    { value: "roi", label: "ROI Analysis" },
                    { value: "sensitivity", label: "Sensitivity Analysis" },
                  ] as { value: DashboardTab; label: string }[]).map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-xs font-medium"
                    >
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <div className="px-8 py-6 max-w-6xl mx-auto w-full">
                {/* Validation warnings - show on all tabs */}
                {warnings.length > 0 && (
                  <div className="space-y-2 mb-6">
                    {warnings.map((w) => (
                      <div key={w.id} className={cn("flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-xs font-medium",
                        w.severity === "error" ? "bg-destructive/5 border-destructive/20 text-destructive" : "bg-warning/5 border-warning/20 text-warning")}>
                        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{w.message}
                      </div>
                    ))}
                  </div>
                )}

                {/* ═══ EXECUTIVE SUMMARY TAB ═══ */}
                <TabsContent value="summary" className="mt-0 space-y-6 animate-fade-in">
                  {/* KPI row */}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <KPICard label="Annual EBITDA" value={kpis.totalRevenueMonth === 0 ? "—" : formatCurrency(kpis.ebitdaYear)} icon={BarChart3}
                      variant={kpis.ebitdaYear >= 0 ? "success" : "destructive"}
                      subtitle={marginVal !== null ? `${marginVal.toFixed(0)}% margin` : undefined} />
                    <KPICard label="Payback Period" value={kpis.ebitdaYear <= 0 ? "N/A" : formatSafeYears(kpis.paybackYears)} icon={Clock}
                      variant={isSafeValid(kpis.paybackYears) ? (kpis.paybackYears.value! <= 3 ? "success" : kpis.paybackYears.value! <= 5 ? "warning" : "destructive") : "default"} />
                    <KPICard label="Annual Revenue" value={formatCurrency(kpis.totalRevenueYear)} icon={TrendingUp} variant="accent"
                      subtitle={`${formatCurrency(kpis.totalRevenueMonth)}/month`} />
                    <KPICard label="ROI" value={isSafeValid(kpis.roi) ? `${kpis.roi.value!.toFixed(1)}%` : "—"} icon={PieChart}
                      variant={isSafeValid(kpis.roi) ? (kpis.roi.value! >= 15 ? "success" : "warning") : "default"} />
                  </div>

                  {/* Verdict + Insight + Confidence row */}
                  <div className="grid gap-5 md:grid-cols-3">
                    {/* Verdict */}
                    {verdict && (
                      <div className={cn("border rounded-2xl p-5 relative overflow-hidden", verdictColors[verdict.level])}>
                        <div className="flex items-center gap-2 mb-4">
                          <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", verdictIconColors[verdict.level])}>
                            <Shield className="h-4 w-4" />
                          </div>
                          <div className="flex-1">
                            <p className="text-[11px] text-muted-foreground font-medium">Investment Attractiveness</p>
                          </div>
                          <Badge variant="outline" className={cn("text-[9px] py-0 font-bold uppercase", verdictColors[verdict.level])}>
                            {verdict.label}
                          </Badge>
                        </div>
                        <div className="space-y-2 mb-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> Payback</span>
                            <span className="text-xs font-semibold tabular-nums">{verdict.metrics.payback}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1"><TrendingUp className="h-2.5 w-2.5" /> Margin</span>
                            <span className="text-xs font-semibold tabular-nums">{verdict.metrics.margin}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Target className="h-2.5 w-2.5" /> BE buffer</span>
                            <span className="text-xs font-semibold tabular-nums">{verdict.metrics.buffer}</span>
                          </div>
                        </div>
                        <p className="text-[10px] italic leading-snug text-muted-foreground">{verdict.interpretation}</p>
                      </div>
                    )}

                    {/* Key Insight */}
                    {structuredInsight && (
                      <div className="bg-card border rounded-2xl p-5 space-y-4">
                        <div className="flex items-center gap-2">
                          <Lightbulb className="h-4 w-4 text-warning" />
                          <span className="text-xs font-semibold uppercase tracking-wide">Key Insight</span>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> What drives profit</p>
                            <p className="text-xs leading-relaxed">{structuredInsight.profitDrivers}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-success mb-0.5 flex items-center gap-1"><Zap className="h-3 w-3" /> Best action</p>
                            <p className="text-xs leading-relaxed">{structuredInsight.bestAction}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-destructive mb-0.5 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Main risk</p>
                            <p className="text-xs leading-relaxed">{structuredInsight.mainRisk}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Model Confidence */}
                    {confidence && (
                      <div className="bg-card border rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-4">
                          <Gauge className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs font-semibold uppercase tracking-wide">Model Confidence</span>
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                          <div className={cn("h-3 w-3 rounded-full", confidence.level === "high" ? "bg-success" : confidence.level === "medium" ? "bg-warning" : "bg-destructive")} />
                          <span className={cn("text-base font-bold capitalize", confColors[confidence.level])}>{confidence.level}</span>
                        </div>
                        {confidence.reasons.length > 0 && (
                          <div className="space-y-1.5 mb-3">
                            {confidence.reasons.map((r, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <Info className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                                <p className="text-[11px] text-muted-foreground">{r}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        <Button variant="outline" size="sm" className="w-full rounded-xl text-xs gap-1.5"
                          onClick={() => navigate(`/project/${project.id}/inputs`)}>
                          <Settings className="h-3 w-3" /> Improve accuracy
                        </Button>
                      </div>
                    )}
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
