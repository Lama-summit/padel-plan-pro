import { useMemo } from "react";
import { ProjectInputs, Scenario, SCENARIO_MULTIPLIERS, DEFAULT_INPUTS } from "@/lib/types";
import { calculateDriverDeltas } from "@/lib/calculations";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SlidersHorizontal,
  LayoutGrid,
  Tag,
  BarChart3,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface KeyDriversPanelProps {
  inputs: ProjectInputs;
  onChange: (key: keyof ProjectInputs, value: string | number) => void;
  onReset?: () => void;
  scenario?: Scenario;
  collapsed?: boolean;
  onToggle?: () => void;
  className?: string;
  readOnly?: boolean;
}

export function KeyDriversPanel({
  inputs,
  onChange,
  onReset,
  scenario = "base",
  collapsed = false,
  onToggle,
  className,
  readOnly = false,
}: KeyDriversPanelProps) {
  const offset = SCENARIO_MULTIPLIERS[scenario].occupancyOffset;
  const derivedOffPeak = Math.min(100, Math.max(0, inputs.offPeakOccupancy + offset));
  const derivedPeak = Math.min(100, Math.max(0, inputs.peakOccupancy + offset));
  const deltas = useMemo(() => calculateDriverDeltas(inputs, scenario), [inputs, scenario]);

  if (collapsed) {
    return (
      <div className={cn("flex flex-col items-center py-4 gap-3 w-12 bg-card border-l", className)}>
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={onToggle} title="Open Key Drivers">
          <PanelRightOpen className="h-4 w-4" />
        </Button>
        <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
    );
  }

  return (
    <aside className={cn("w-[300px] flex-shrink-0 bg-card border-l overflow-y-auto transition-all duration-300", className)}>
      <div className="p-5 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-accent/15 flex items-center justify-center">
              <SlidersHorizontal className="h-4 w-4 text-accent-foreground" />
            </div>
            <h3 className="font-semibold text-sm">Key Drivers</h3>
          </div>
          <div className="flex items-center gap-1">
            {onReset && !readOnly && (
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={onReset} title="Reset to defaults">
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}
            {onToggle && (
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={onToggle}>
                <PanelRightClose className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {readOnly && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/60 border border-border">
            <Info className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-snug">Derived from Base scenario</p>
          </div>
        )}

        {/* Capacity */}
        <DriverSection icon={LayoutGrid} label="Capacity" hint="Defines capacity">
          <CompactSlider
            label="Courts"
            value={inputs.numberOfCourts}
            min={1} max={16} step={1}
            onChange={(v) => onChange("numberOfCourts", v)}
            delta={deltas.numberOfCourts}
            disabled={readOnly}
          />
          <CompactSlider
            label="Hours / Day"
            value={inputs.openingHoursPerDay}
            min={6} max={20} step={1} suffix="hrs"
            onChange={(v) => onChange("openingHoursPerDay", v)}
            delta={deltas.openingHoursPerDay}
            disabled={readOnly}
          />
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Court Type</Label>
            <div className="flex bg-muted rounded-lg p-0.5 gap-0.5">
              {(["indoor", "outdoor", "mixed"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => !readOnly && onChange("courtType", type)}
                  disabled={readOnly}
                  className={cn(
                    "flex-1 px-2 py-1.5 text-xs rounded-md transition-all font-medium capitalize",
                    inputs.courtType === type ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
                    readOnly && "opacity-60 cursor-not-allowed"
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
          <CompactNumber label="Off-Peak Price" value={inputs.offPeakPrice} suffix="€/hr"
            onChange={(v) => onChange("offPeakPrice", v)} delta={deltas.offPeakPrice} disabled={readOnly} />
          <CompactNumber label="Peak Price" value={inputs.peakPrice} suffix="€/hr"
            onChange={(v) => onChange("peakPrice", v)} delta={deltas.peakPrice} disabled={readOnly} />
        </DriverSection>

        {/* Demand */}
        <DriverSection icon={BarChart3} label="Demand" hint="Main revenue driver">
          <CompactSlider
            label="Off-Peak Occupancy"
            value={readOnly ? derivedOffPeak : inputs.offPeakOccupancy}
            min={0} max={100} step={5} suffix="%"
            onChange={(v) => onChange("offPeakOccupancy", v)}
            delta={deltas.offPeakOccupancy}
            disabled={readOnly}
          />
          <CompactSlider
            label="Peak Occupancy"
            value={readOnly ? derivedPeak : inputs.peakOccupancy}
            min={0} max={100} step={5} suffix="%"
            onChange={(v) => onChange("peakOccupancy", v)}
            delta={deltas.peakOccupancy}
            disabled={readOnly}
          />
          {readOnly && offset !== 0 && (
            <p className="text-[10px] text-muted-foreground italic pl-1">
              Base {offset > 0 ? "+" : ""}{offset} pp
            </p>
          )}
          {(() => {
            const peakH = inputs.peakHoursPerDay || 0;
            const offPeakH = (inputs.openingHoursPerDay || 0) - peakH;
            const totalH = peakH + offPeakH;
            const peakOcc = readOnly ? derivedPeak : inputs.peakOccupancy;
            const offPeakOcc = readOnly ? derivedOffPeak : inputs.offPeakOccupancy;
            const weighted = totalH > 0 ? Math.round((peakOcc * peakH + offPeakOcc * offPeakH) / totalH) : 0;
            return (
              <div className="mt-1 px-2.5 py-1.5 rounded-lg bg-muted/60 border border-border">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Weighted Avg. Occupancy</span>
                  <span className="text-sm font-bold tabular-nums">{weighted}<span className="text-[10px] text-muted-foreground ml-0.5 font-medium">%</span></span>
                </div>
                <p className="text-[9px] text-muted-foreground mt-0.5">{peakH}h peak · {offPeakH}h off-peak</p>
              </div>
            );
          })()}
        </DriverSection>
      </div>
    </aside>
  );
}

/* ─── Sub-components ──────────────────────────────────────── */

function DeltaIndicator({ delta }: { delta?: { annualRevenueImpact: number; ebitdaImpact: number; paybackImpact: number | null } }) {
  if (!delta) return null;
  const hasRevenue = delta.annualRevenueImpact !== 0;
  const hasEbitda = delta.ebitdaImpact !== 0;
  const hasPayback = delta.paybackImpact !== null && delta.paybackImpact !== 0;
  if (!hasRevenue && !hasEbitda && !hasPayback) return null;

  const fmtK = (val: number) => {
    const abs = Math.abs(val);
    const str = abs >= 1000 ? `€${(abs / 1000).toFixed(0)}K` : `€${abs.toFixed(0)}`;
    return val >= 0 ? `+${str}` : `-${str}`;
  };

  return (
    <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-0.5">
      {hasRevenue && (
        <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-medium", delta.annualRevenueImpact > 0 ? "text-success" : "text-destructive")}>
          {delta.annualRevenueImpact > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
          {fmtK(delta.annualRevenueImpact)} rev
        </span>
      )}
      {hasEbitda && (
        <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-medium", delta.ebitdaImpact > 0 ? "text-success" : "text-destructive")}>
          {fmtK(delta.ebitdaImpact)} EBITDA
        </span>
      )}
      {hasPayback && (
        <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-medium", delta.paybackImpact! < 0 ? "text-success" : "text-destructive")}>
          {delta.paybackImpact! < 0 ? "" : "+"}{delta.paybackImpact!.toFixed(1)}yr
        </span>
      )}
    </div>
  );
}

function DriverSection({ icon: Icon, label, hint, children }: {
  icon: React.ElementType; label: string; hint: string; children: React.ReactNode;
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

function CompactSlider({ label, value, min, max, step, suffix, onChange, delta, disabled }: {
  label: string; value: number; min: number; max: number; step: number; suffix?: string;
  onChange: (v: number) => void; delta?: { annualRevenueImpact: number; ebitdaImpact: number; paybackImpact: number | null };
  disabled?: boolean;
}) {
  return (
    <div className={cn("space-y-1.5", disabled && "opacity-60")}>
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="text-sm font-bold tabular-nums">
          {value}
          {suffix && <span className="text-[10px] text-muted-foreground ml-0.5 font-medium">{suffix}</span>}
        </span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => !disabled && onChange(v)} disabled={disabled} className="py-0.5" />
      {!disabled && <DeltaIndicator delta={delta} />}
    </div>
  );
}

function CompactNumber({ label, value, suffix, onChange, delta, disabled }: {
  label: string; value: number; suffix?: string; onChange: (v: string) => void;
  delta?: { annualRevenueImpact: number; ebitdaImpact: number; paybackImpact: number | null };
  disabled?: boolean;
}) {
  return (
    <div className={cn("space-y-1.5", disabled && "opacity-60")}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input type="number" value={value} onChange={(e) => !disabled && onChange(e.target.value)}
          className="h-8 text-sm font-medium rounded-lg pr-10" disabled={disabled} />
        {suffix && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium">{suffix}</span>
        )}
      </div>
      {!disabled && <DeltaIndicator delta={delta} />}
    </div>
  );
}
