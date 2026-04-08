import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/lib/store";
import { Plus, Search, MapPin, Calendar, FolderOpen, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCY_OPTIONS, CURRENCIES, CurrencyCode } from "@/lib/currency";

export default function ProjectsHome() {
  const { projects, createProject } = useStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newCurrency, setNewCurrency] = useState<CurrencyCode>("EUR");

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.location.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    if (!newName.trim()) return;
    const p = createProject(newName, newLocation, newCurrency);
    setDialogOpen(false);
    setNewName("");
    setNewLocation("");
    setNewCurrency("EUR");
    navigate(`/project/${p.id}`);
  };

  const statusColor = (s: string) => {
    if (s === "active") return "bg-success/10 text-success border-success/20";
    if (s === "draft") return "bg-warning/10 text-warning border-warning/20";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">PadelSim</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Business Simulation & Planning</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 rounded-xl shadow-md shadow-primary/20">
                <Plus className="h-4 w-4" />
                Create Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Project</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Project Name</Label>
                  <Input placeholder="e.g. Padel Madrid Central" className="rounded-xl" value={newName} onChange={(e) => setNewName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input placeholder="e.g. Madrid, Spain" className="rounded-xl" value={newLocation} onChange={(e) => setNewLocation(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={newCurrency} onValueChange={(v) => setNewCurrency(v as CurrencyCode)}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCY_OPTIONS.map((code) => (
                        <SelectItem key={code} value={code}>
                          <span className="font-medium">{CURRENCIES[code].symbol}</span>
                          <span className="ml-2 text-muted-foreground">{CURRENCIES[code].name} ({code})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full rounded-xl" onClick={handleCreate}>Create Project</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="relative mb-8 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            className="pl-10 rounded-xl h-11"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <FolderOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No projects yet</h2>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Create your first padel club simulation to start planning your business.
            </p>
            <Button onClick={() => setDialogOpen(true)} className="gap-2 rounded-xl">
              <Plus className="h-4 w-4" />
              Create Project
            </Button>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((project) => (
              <button
                key={project.id}
                onClick={() => navigate(`/project/${project.id}`)}
                className="bg-card border rounded-2xl p-6 text-left card-hover cursor-pointer group relative"
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors text-base">
                    {project.name}
                  </h3>
                  <Badge variant="outline" className={`${statusColor(project.status)} text-[10px] uppercase tracking-wide font-semibold`}>
                    {project.status}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{project.location || "No location"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {project.versions.length} version{project.versions.length !== 1 ? "s" : ""} · {CURRENCIES[project.currency as CurrencyCode]?.symbol ?? "€"} {project.currency}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
