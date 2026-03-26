import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/lib/store";
import { Plus, Search, MapPin, Calendar, FolderOpen } from "lucide-react";
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

export default function ProjectsHome() {
  const { projects, createProject } = useStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newCurrency, setNewCurrency] = useState("EUR");

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
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">PadelSim</h1>
            <p className="text-sm text-muted-foreground">Business Simulation & Planning</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
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
                  <Input placeholder="e.g. Padel Madrid Central" value={newName} onChange={(e) => setNewName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input placeholder="e.g. Madrid, Spain" value={newLocation} onChange={(e) => setNewLocation(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Input placeholder="EUR" value={newCurrency} onChange={(e) => setNewCurrency(e.target.value)} />
                </div>
                <Button className="w-full" onClick={handleCreate}>Create Project</Button>
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
            className="pl-10"
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
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Project
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((project) => (
              <button
                key={project.id}
                onClick={() => navigate(`/project/${project.id}`)}
                className="bg-card border rounded-xl p-5 text-left card-hover cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {project.name}
                  </h3>
                  <Badge variant="outline" className={statusColor(project.status)}>
                    {project.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
                  <MapPin className="h-3.5 w-3.5" />
                  {project.location || "No location"}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  Updated {new Date(project.updatedAt).toLocaleDateString()}
                </div>
                <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                  {project.versions.length} version{project.versions.length !== 1 ? "s" : ""}
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
