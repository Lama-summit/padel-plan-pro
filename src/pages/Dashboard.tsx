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
import { ArrowLeft, Plus, Settings, TrendingUp, DollarSign, PieChart, Target, Clock, BarChart3 } from "lucide-react";

const SCENARIOS: { value: Scenario; label: string }[] = [
  { value: "base", label: "Base" },
  { value: "optimistic", label: "Optimistic" },
  { value: "pessimistic", label: "Pessimistic" },
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
          <div className="flex items-center gap-3 mb-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">{project.name}</h1>
              <p className="text-sm text-muted-foreground">{project.location}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={activeVersion.id} onValueChange={(v) => setActiveVersion(project.id, v)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {project.versions.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> New Version
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Version</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Version Name</Label>
                    <Input placeholder="e.g. V2 - Expanded" value={newVersionName} onChange={(e) => setNewVersionName(e.target.value)} />
                  </div>
                  <Button className="w-full" onClick={handleNewVersion}>Create</Button>
                </div>
              </DialogContent>
            </Dialog>

            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate(`/project/${project.id}/inputs`)}>
              <Settings className="h-3.5 w-3.5" /> Edit Inputs
            </Button>

            <div className="ml-auto flex bg-muted rounded-lg p-0.5">
              {SCENARIOS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setScenario(s.value)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-all font-medium ${
                    scenario === s.value
                      ? "bg-card shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* KPIs */}
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6 animate-fade-in">
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          <KPICard label="Total Investment" value={formatCurrency(kpis.totalInvestment)} icon={DollarSign} />
          <KPICard label="Annual Revenue" value={formatCurrency(kpis.annualRevenue)} icon={TrendingUp} variant="accent" />
          <KPICard label="Annual EBITDA" value={formatCurrency(kpis.ebitda)} icon={BarChart3} variant={kpis.ebitda >= 0 ? "accent" : "destructive"} />
          <KPICard label="ROI" value={`${kpis.roi.toFixed(1)}%`} icon={PieChart} />
          <KPICard label="Payback" value={kpis.paybackYears === Infinity ? "N/A" : `${kpis.paybackYears.toFixed(1)}y`} icon={Clock} />
        </div>

        {/* Break-even highlight */}
        <div className="bg-card border rounded-xl p-5 flex items-center gap-6">
          <div className="h-12 w-12 rounded-xl gradient-accent flex items-center justify-center flex-shrink-0">
            <Target className="h-6 w-6 text-accent-foreground" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Break-even Occupancy</p>
            <p className="text-2xl font-bold">{kpis.breakEvenOccupancy.toFixed(0)}%</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-sm text-muted-foreground">Current Avg. Occupancy</p>
            <p className={`text-2xl font-bold ${kpis.weightedOccupancy >= kpis.breakEvenOccupancy ? "text-success" : "text-destructive"}`}>
              {kpis.weightedOccupancy.toFixed(0)}%
            </p>
          </div>
        </div>

        {/* Charts */}
        <DashboardCharts monthlyData={monthlyData} kpis={kpis} />
      </main>
    </div>
  );
}
