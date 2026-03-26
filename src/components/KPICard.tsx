import { LucideIcon } from "lucide-react";

interface KPICardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  variant?: "default" | "accent" | "destructive";
}

export function KPICard({ label, value, icon: Icon, variant = "default" }: KPICardProps) {
  const iconBg = {
    default: "bg-primary/10 text-primary",
    accent: "bg-accent/10 text-accent",
    destructive: "bg-destructive/10 text-destructive",
  }[variant];

  return (
    <div className="bg-card border rounded-xl p-5 card-hover">
      <div className="flex items-center gap-3 mb-3">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
    </div>
  );
}
