import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  variant?: "default" | "accent" | "success" | "warning" | "destructive";
  size?: "default" | "large";
  subtitle?: string;
}

export function KPICard({ label, value, icon: Icon, variant = "default", size = "default", subtitle }: KPICardProps) {
  const colorMap = {
    default: {
      icon: "bg-primary/10 text-primary",
      value: "text-foreground",
    },
    accent: {
      icon: "bg-accent/10 text-accent",
      value: "text-accent",
    },
    success: {
      icon: "bg-success/10 text-success",
      value: "text-success",
    },
    warning: {
      icon: "bg-warning/10 text-warning",
      value: "text-warning",
    },
    destructive: {
      icon: "bg-destructive/10 text-destructive",
      value: "text-destructive",
    },
  };

  const colors = colorMap[variant];
  const isLarge = size === "large";

  return (
    <div className={cn(
      "bg-card border rounded-2xl card-hover relative overflow-hidden",
      isLarge ? "p-7" : "p-6"
    )}>
      <div className="flex items-start justify-between mb-4">
        <div className={cn(
          "rounded-xl flex items-center justify-center",
          colors.icon,
          isLarge ? "h-12 w-12" : "h-10 w-10"
        )}>
          <Icon className={isLarge ? "h-6 w-6" : "h-5 w-5"} />
        </div>
      </div>
      <p className={cn(
        "text-muted-foreground mb-1.5 font-medium",
        isLarge ? "text-sm" : "text-xs"
      )}>{label}</p>
      <p className={cn(
        "font-bold tracking-tight leading-none",
        colors.value,
        isLarge ? "text-4xl" : "text-2xl"
      )}>{value}</p>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-2">{subtitle}</p>
      )}
    </div>
  );
}