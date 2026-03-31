import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStore } from "@/lib/store";
import { calculateKPIs, getMonthlyEvolution } from "@/lib/calculations";
import { Scenario } from "@/lib/types";
import { KPICard } from "@/components/KPICard";
import { DashboardCharts } from "@/components/DashboardCharts";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Plus,
  Settings,
  TrendingUp,
  DollarSign,
  PieChart,
  Target,
  Clock,
  BarChart3,
  ChevronDown,
  GitBranch,
} from "lucide-react";

const SCENARIOS: { value: Scenario; label: string; color: string }[] = [
  { value: "base", label: "Base", color: "data-[active=true]:bg-primary data-[active=true]:text-primary-foreground" },
  { value: "optimistic", label: "Optimistic", color: "data-[active=true]:bg-success data-[active=true]:text-success-foreground" },
  { value: "pessimistic", label: "Pessimistic", color: "data-[active=true]:bg-warning data-[active=true]:text-warning-foreground" },
];

export default function Dashboard() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { getProject, setActiveVersion, createVersion: createVersionFn } = useStore();
  const [scenario, setScenario] = useState<Scenario>("base");
  const [newVersionName, setNewVersionName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

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

  const formatCurrency = (val: number) => {
    if (val >= 1_000_000) return `€${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `€${(val / 1_000).toFixed(0)}K`;
    return `€${val.toFixed(0)}`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          {/* Top row */}
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold tracking-tight">{project.name}</h1>
              <p className="text-sm text-muted-foreground">{project.location}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 rounded-xl"
              onClick={() => navigate(`/project/${project.id}/inputs`)}
            >
              <Settings className="h-4 w-4" />
              Edit Inputs
            </Button>
          </div>

          {/* Bottom row: version + scenario */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Version selector */}
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
                        <span className="text-xs text-muted-foreground">
                          {new Date(v.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 rounded-xl">
                  <Plus className="h-3.5 w-3.5" /> New Version
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Version</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Version Name</Label>
                    <Input
                      placeholder="e.g. V2 - Expanded"
                      value={newVersionName}
                      onChange={(e) => setNewVersionName(e.target.value)}
                    />
                  </div>
                  <Button className="w-full rounded-xl" onClick={handleNewVersion}>Create</Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Scenario switcher */}
            <div className="ml-auto flex bg-muted rounded-xl p-1 gap-0.5">
              {SCENARIOS.map((s) => (
                <button
                  key={s.value}
                  data-active={scenario === s.value}
                  onClick={() => setScenario(s.value)}
                  className={`px-4 py-1.5 text-sm rounded-lg transition-all font-medium text-muted-foreground hover:text-foreground ${s.color}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8 animate-fade-in">
        {/* Section label */}
        <p className="section-title">Key Performance Indicators</p>

        {/* Primary KPIs - larger */}
        <div className="grid gap-5 md:grid-cols-2">
          <KPICard
            label="Total Investment"
            value={formatCurrency(kpis.totalInvestment)}
            icon={DollarSign}
            size="large"
          />
          <KPICard
            label="Annual EBITDA"
            value={formatCurrency(kpis.ebitdaYear)}
            icon={BarChart3}
            size="large"
            variant={kpis.ebitdaYear >= 0 ? "success" : "destructive"}
            subtitle={`${(kpis.ebitdaMargin * 100).toFixed(0)}% margin · ${kpis.ebitdaYear >= 0 ? "Profitable" : "Loss-making"}`}
          />
        </div>

        {/* Secondary KPIs */}
        <div className="grid gap-5 md:grid-cols-3">
          <KPICard
            label="Annual Revenue"
            value={formatCurrency(kpis.annualRevenue)}
            icon={TrendingUp}
            variant="accent"
          />
          <KPICard
            label="Return on Investment"
            value={`${kpis.roi.toFixed(1)}%`}
            icon={PieChart}
            variant={kpis.roi >= 15 ? "success" : kpis.roi >= 0 ? "warning" : "destructive"}
          />
          <KPICard
            label="Payback Period"
            value={kpis.paybackYears === Infinity ? "N/A" : `${kpis.paybackYears.toFixed(1)} years`}
            icon={Clock}
            variant={kpis.paybackYears <= 5 ? "success" : kpis.paybackYears <= 8 ? "warning" : "destructive"}
          />
        </div>

        {/* Break-even highlight */}
        <div className="bg-card border-2 border-accent/20 rounded-2xl p-7 flex items-center gap-8">
          <div className="h-14 w-14 rounded-2xl gradient-accent flex items-center justify-center flex-shrink-0 shadow-lg shadow-accent/20">
            <Target className="h-7 w-7 text-accent-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Break-even Occupancy</p>
            <p className="text-4xl font-bold tracking-tight">{kpis.breakEvenOccupancy.toFixed(0)}%</p>
          </div>
          <div className="hidden sm:block h-12 w-px bg-border" />
          <div className="hidden sm:block text-right">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Current Avg. Occupancy</p>
            <p className={`text-4xl font-bold tracking-tight ${
              kpis.weightedOccupancy >= kpis.breakEvenOccupancy ? "text-success" : "text-destructive"
            }`}>
              {kpis.weightedOccupancy.toFixed(0)}%
            </p>
          </div>
          <div className="hidden sm:block">
            <div className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
              kpis.weightedOccupancy >= kpis.breakEvenOccupancy
                ? "bg-success/10 text-success"
                : "bg-destructive/10 text-destructive"
            }`}>
              {kpis.weightedOccupancy >= kpis.breakEvenOccupancy ? "Above target" : "Below target"}
            </div>
          </div>
        </div>

        {/* Charts */}
        <div>
          <p className="section-title mb-5">Financial Overview</p>
          <DashboardCharts monthlyData={monthlyData} kpis={kpis} />
        </div>
      </main>
    </div>
  );
}