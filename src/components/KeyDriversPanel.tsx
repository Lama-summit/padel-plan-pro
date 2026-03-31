import { ProjectInputs } from "@/lib/types";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SlidersHorizontal,
  LayoutGrid,
  Clock,
  Tag,
  BarChart3,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface KeyDriversPanelProps {
  inputs: ProjectInputs;
  onChange: (key: keyof ProjectInputs, value: string | number) => void;
  collapsed?: boolean;
  onToggle?: () => void;
  className?: string;
}

export function KeyDriversPanel({
  inputs,
  onChange,
  collapsed = false,
  onToggle,
  className,
}: KeyDriversPanelProps) {
  if (collapsed) {
    return (
      <div className={cn("flex flex-col items-center py-4 gap-3 w-12 bg-card border-l", className)}>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl"
          onClick={onToggle}
          title="Open Key Drivers"
        >
          <PanelRightOpen className="h-4 w-4" />
        </Button>
        <div className="flex flex-col items-center gap-2 mt-2">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <aside
      className={cn(
        "w-[300px] flex-shrink-0 bg-card border-l overflow-y-auto transition-all duration-300",
        className
      )}
    >
      <div className="p-5 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-accent/15 flex items-center justify-center">
              <SlidersHorizontal className="h-4 w-4 text-accent-foreground" />
            </div>
            <h3 className="font-semibold text-sm">Key Drivers</h3>
          </div>
          {onToggle && (
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={onToggle}>
              <PanelRightClose className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Courts & Capacity */}
        <DriverSection icon={LayoutGrid} label="Capacity" hint="Defines capacity">
          <CompactSlider
            label="Courts"
            value={inputs.numberOfCourts}
            min={1}
            max={16}
            step={1}
            onChange={(v) => onChange("numberOfCourts", v)}
          />
          <CompactSlider
            label="Hours / Day"
            value={inputs.openingHoursPerDay}
            min={6}
            max={20}
            step={1}
            suffix="hrs"
            onChange={(v) => onChange("openingHoursPerDay", v)}
          />
          {/* Court type */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Court Type</Label>
            <div className="flex bg-muted rounded-lg p-0.5 gap-0.5">
              {(["indoor", "outdoor", "mixed"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => onChange("courtType", type)}
                  className={cn(
                    "flex-1 px-2 py-1.5 text-xs rounded-md transition-all font-medium capitalize",
                    inputs.courtType === type
                      ? "bg-card shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </DriverSection>

        {/* Pricing */}
        <DriverSection icon={Tag} label="Pricing" hint="Impacts margin">
          <CompactNumber
            label="Off-Peak Price"
            value={inputs.offPeakPrice}
            suffix="€/hr"
            onChange={(v) => onChange("offPeakPrice", v)}
          />
          <CompactNumber
            label="Peak Price"
            value={inputs.peakPrice}
            suffix="€/hr"
            onChange={(v) => onChange("peakPrice", v)}
          />
        </DriverSection>

        {/* Occupancy */}
        <DriverSection icon={BarChart3} label="Occupancy" hint="Main revenue driver">
          <CompactSlider
            label="Off-Peak"
            value={inputs.offPeakOccupancy}
            min={0}
            max={100}
            step={5}
            suffix="%"
            onChange={(v) => onChange("offPeakOccupancy", v)}
          />
          <CompactSlider
            label="Peak"
            value={inputs.peakOccupancy}
            min={0}
            max={100}
            step={5}
            suffix="%"
            onChange={(v) => onChange("peakOccupancy", v)}
          />
        </DriverSection>
      </div>
    </aside>
  );
}

/* ─── Sub-components ──────────────────────────────────────── */

function DriverSection({
  icon: Icon,
  label,
  hint,
  children,
}: {
  icon: React.ElementType;
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wide text-foreground">{label}</span>
        <span className="text-[10px] text-muted-foreground ml-auto">{hint}</span>
      </div>
      <div className="space-y-3 pl-5">{children}</div>
    </div>
  );
}

function CompactSlider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="text-sm font-bold tabular-nums">
          {value}
          {suffix && <span className="text-[10px] text-muted-foreground ml-0.5 font-medium">{suffix}</span>}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        className="py-0.5"
      />
    </div>
  );
}

function CompactNumber({
  label,
  value,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  suffix?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-sm font-medium rounded-lg pr-10"
        />
        {suffix && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
