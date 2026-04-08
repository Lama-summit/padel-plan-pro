import { useMemo } from "react";
import { ProjectInputs } from "@/lib/types";
import { KPIResult, RevenueBreakdown } from "@/lib/calculations";
import { formatCurrency, getCurrencySymbol } from "@/lib/currency";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  Lock,
  GraduationCap,
  Trophy,
  Store,
  TrendingUp,
  Info,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RevenueModelTabProps {
  inputs: ProjectInputs;
  kpis: KPIResult;
  onInputChange: (key: keyof ProjectInputs, value: string | number | boolean) => void;
  readOnly: boolean;
  currency?: string;
}

const PIE_COLORS = [
  "hsl(217 91% 60%)",
  "hsl(152 69% 41%)",
  "hsl(38 92% 50%)",
  "hsl(280 67% 55%)",
];

export function RevenueModelTab({
  inputs,
  kpis,
  onInputChange,
  readOnly,
  currency = "EUR",
}: RevenueModelTabProps) {
  const sym = getCurrencySymbol(currency);
  const fmt = (val: number) => formatCurrency(val, currency);
  const rb = kpis.revenueBreakdown;

  // Build pie data for contribution breakdown
  const pieData = useMemo(() => {
    const items = [
      { name: "Court Bookings", value: rb.courtRevenue, color: PIE_COLORS[0] },
    ];
    if (inputs.coachingEnabled && rb.coachingRevenue > 0) {
      items.push({ name: "Coaching", value: rb.coachingRevenue, color: PIE_COLORS[1] });
    }
    if (inputs.tournamentsEnabled && rb.tournamentRevenue > 0) {
      items.push({ name: "Events", value: rb.tournamentRevenue, color: PIE_COLORS[2] });
    }
    if (inputs.otherRevenueEnabled && rb.otherRevenue > 0) {
      items.push({ name: "Other", value: rb.otherRevenue, color: PIE_COLORS[3] });
    }
    return items.filter((i) => i.value > 0);
  }, [rb, inputs]);

  // Bar data for contribution chart
  const barData = useMemo(() => {
    const items = [
      { name: "Bookings", gross: rb.courtRevenue, net: rb.courtRevenue },
    ];
    if (inputs.coachingEnabled) {
      items.push({ name: "Coaching", gross: rb.coachingRevenue, net: rb.coachingNet });
    }
    if (inputs.tournamentsEnabled) {
      items.push({ name: "Events", gross: rb.tournamentRevenue, net: rb.tournamentNet });
    }
    if (inputs.otherRevenueEnabled) {
      items.push({ name: "Other", gross: rb.otherRevenue, net: rb.otherRevenue });
    }
    return items;
  }, [rb, inputs]);

  const pct = (val: number) =>
    rb.totalRevenue > 0 ? ((val / rb.totalRevenue) * 100).toFixed(0) : "0";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Total Revenue Summary ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-card border-2 border-foreground/10 rounded-xl p-5">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">
            Total Annual Revenue
          </p>
          <p className="text-2xl font-extrabold tabular-nums">
            {fmt(rb.totalRevenue)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {fmt(kpis.totalRevenueMonth)}/mo
          </p>
        </div>
        <SummaryCard
          label="Court Bookings"
          value={fmt(rb.courtRevenue)}
          pct={`${pct(rb.courtRevenue)}%`}
          color="text-[hsl(217_91%_60%)]"
        />
        <SummaryCard
          label="Add-on Revenue"
          value={fmt(rb.coachingRevenue + rb.tournamentRevenue + rb.otherRevenue)}
          pct={`${pct(rb.coachingRevenue + rb.tournamentRevenue + rb.otherRevenue)}%`}
          color="text-success"
        />
        <SummaryCard
          label="Net Contribution"
          value={fmt(rb.coachingNet + rb.tournamentNet + rb.otherRevenue)}
          pct="after costs"
          color="text-foreground"
        />
      </div>

      {/* ── Revenue Breakdown Chart + Pie ── */}
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="bg-card border rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Revenue by Source (Annual)</h3>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData} barCategoryGap="25%">
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(220 13% 91%)"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "hsl(220 9% 46%)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v: number) =>
                  Math.abs(v) >= 1000
                    ? `${sym}${(v / 1000).toFixed(0)}K`
                    : `${sym}${v}`
                }
                tick={{ fontSize: 11, fill: "hsl(220 9% 46%)" }}
                axisLine={false}
                tickLine={false}
              />
              <RechartsTooltip
                content={({ active, payload, label }: any) => {
                  if (!active || !payload) return null;
                  return (
                    <div className="bg-card border rounded-xl px-4 py-3 shadow-xl shadow-foreground/5">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        {label}
                      </p>
                      {payload.map((entry: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <div
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span className="text-muted-foreground">
                            {entry.name}:
                          </span>
                          <span className="font-semibold">
                            {sym}
                            {entry.value?.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="gross"
                name="Gross"
                fill="hsl(217 91% 60%)"
                radius={[4, 4, 0, 0]}
                fillOpacity={0.3}
              />
              <Bar
                dataKey="net"
                name="Net"
                fill="hsl(152 69% 41%)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {pieData.length > 0 && (
          <div className="bg-card border rounded-2xl p-6 flex flex-col items-center justify-center">
            <h3 className="text-sm font-semibold mb-3 self-start">
              Revenue Mix
            </h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  strokeWidth={2}
                  stroke="hsl(var(--card))"
                >
                  {pieData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <RechartsTooltip
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.[0]) return null;
                    const d = payload[0];
                    return (
                      <div className="bg-card border rounded-lg px-3 py-2 shadow-lg text-xs">
                        <p className="font-medium">{d.name}</p>
                        <p className="tabular-nums">
                          {sym}
                          {d.value?.toLocaleString()}
                        </p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 justify-center mt-2">
              {pieData.map((d, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: d.color }}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {d.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══ CORE REVENUE (READ-ONLY) ═══ */}
      <ModuleCard
        icon={Lock}
        title="Core Revenue (Court Bookings)"
        subtitle="courts × hours/day × occupancy × price"
        enabled
        alwaysOn
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <ReadOnlyMetric label="Monthly Revenue" value={fmt(kpis.courtRevenueMonth)} />
          <ReadOnlyMetric label="Annual Revenue" value={fmt(rb.courtRevenue)} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">
          {inputs.numberOfCourts} courts × {inputs.openingHoursPerDay}h/day ×{" "}
          {kpis.weightedOccupancy.toFixed(0)}% avg occ
        </p>
      </ModuleCard>

      {/* ═══ MODULE A: COACHING / CLASSES ═══ */}
      <ModuleCard
        icon={GraduationCap}
        title="Coaching / Classes"
        subtitle="Revenue from structured coaching sessions"
        enabled={inputs.coachingEnabled}
        onToggle={(v) => onInputChange("coachingEnabled", v)}
        readOnly={readOnly}
        contribution={
          inputs.coachingEnabled ? { gross: rb.coachingRevenue, net: rb.coachingNet } : undefined
        }
        currency={currency}
      >
        {inputs.coachingEnabled && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <SliderField
                label="Court hours for coaching"
                value={inputs.coachingPctOfHours}
                min={0}
                max={50}
                step={5}
                suffix="%"
                onChange={(v) => onInputChange("coachingPctOfHours", v)}
                disabled={readOnly}
              />
              <NumberField
                label="Price per coaching hour"
                value={inputs.coachingPricePerHour}
                suffix={`${sym}/hr`}
                onChange={(v) => onInputChange("coachingPricePerHour", v)}
                disabled={readOnly}
              />
              <SliderField
                label="Coach cost share"
                value={inputs.coachingCostShare}
                min={0}
                max={80}
                step={5}
                suffix="%"
                onChange={(v) => onInputChange("coachingCostShare", v)}
                disabled={readOnly}
                helper="% of coaching revenue paid to coaches"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3 bg-muted/30 rounded-xl p-4">
              <ReadOnlyMetric
                label="Gross Revenue"
                value={fmt(rb.coachingRevenue)}
                size="sm"
              />
              <ReadOnlyMetric
                label="Coach Cost"
                value={`-${fmt(rb.coachingCost)}`}
                size="sm"
                color="text-destructive"
              />
              <ReadOnlyMetric
                label="Net Contribution"
                value={fmt(rb.coachingNet)}
                size="sm"
                color="text-success"
              />
            </div>
          </div>
        )}
      </ModuleCard>

      {/* ═══ MODULE B: TOURNAMENTS / EVENTS ═══ */}
      <ModuleCard
        icon={Trophy}
        title="Tournaments / Events"
        subtitle="Revenue from organized competitions and events"
        enabled={inputs.tournamentsEnabled}
        onToggle={(v) => onInputChange("tournamentsEnabled", v)}
        readOnly={readOnly}
        contribution={
          inputs.tournamentsEnabled
            ? { gross: rb.tournamentRevenue, net: rb.tournamentNet }
            : undefined
        }
        currency={currency}
      >
        {inputs.tournamentsEnabled && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField
                label="Events per month"
                value={inputs.eventsPerMonth}
                suffix="/mo"
                onChange={(v) => onInputChange("eventsPerMonth", v)}
                disabled={readOnly}
              />
              <NumberField
                label="Avg revenue per event"
                value={inputs.avgRevenuePerEvent}
                suffix={sym}
                onChange={(v) => onInputChange("avgRevenuePerEvent", v)}
                disabled={readOnly}
              />
              <NumberField
                label="Avg cost per event"
                value={inputs.avgCostPerEvent}
                suffix={sym}
                onChange={(v) => onInputChange("avgCostPerEvent", v)}
                disabled={readOnly}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3 bg-muted/30 rounded-xl p-4">
              <ReadOnlyMetric
                label="Gross Revenue"
                value={fmt(rb.tournamentRevenue)}
                size="sm"
              />
              <ReadOnlyMetric
                label="Event Costs"
                value={`-${fmt(rb.tournamentCost)}`}
                size="sm"
                color="text-destructive"
              />
              <ReadOnlyMetric
                label="Net Contribution"
                value={fmt(rb.tournamentNet)}
                size="sm"
                color={rb.tournamentNet >= 0 ? "text-success" : "text-destructive"}
              />
            </div>
          </div>
        )}
      </ModuleCard>

      {/* ═══ MODULE C: OTHER REVENUE ═══ */}
      <ModuleCard
        icon={Store}
        title="Other Revenue"
        subtitle="Pro shop, F&B, memberships, and other sources"
        enabled={inputs.otherRevenueEnabled}
        onToggle={(v) => onInputChange("otherRevenueEnabled", v)}
        readOnly={readOnly}
        contribution={
          inputs.otherRevenueEnabled
            ? { gross: rb.otherRevenue, net: rb.otherRevenue }
            : undefined
        }
        currency={currency}
      >
        {inputs.otherRevenueEnabled && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField
                label="Pro Shop / Month"
                value={inputs.proshopRevenue}
                suffix={`${sym}/mo`}
                onChange={(v) => onInputChange("proshopRevenue", v)}
                disabled={readOnly}
              />
              <NumberField
                label="F&B / Month"
                value={inputs.fAndBRevenue}
                suffix={`${sym}/mo`}
                onChange={(v) => onInputChange("fAndBRevenue", v)}
                disabled={readOnly}
              />
              <NumberField
                label="Memberships / Month"
                value={inputs.membershipFees}
                suffix={`${sym}/mo`}
                onChange={(v) => onInputChange("membershipFees", v)}
                disabled={readOnly}
              />
            </div>
            <div className="bg-muted/30 rounded-xl p-4">
              <ReadOnlyMetric
                label="Total Annual Other Revenue"
                value={fmt(rb.otherRevenue)}
                size="sm"
                color="text-success"
              />
            </div>
          </div>
        )}
      </ModuleCard>

      {/* ── Total Revenue Footer ── */}
      <div className="bg-card border-2 border-primary/20 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Total Revenue Summary</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 text-xs text-muted-foreground font-medium">
                  Source
                </th>
                <th className="text-right py-2 text-xs text-muted-foreground font-medium">
                  Monthly
                </th>
                <th className="text-right py-2 text-xs text-muted-foreground font-medium">
                  Annual
                </th>
                <th className="text-right py-2 text-xs text-muted-foreground font-medium">
                  % of Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <RevenueRow
                label="Court Bookings"
                monthly={rb.courtRevenue / 12}
                annual={rb.courtRevenue}
                total={rb.totalRevenue}
                currency={currency}
              />
              {inputs.coachingEnabled && (
                <RevenueRow
                  label="Coaching (net)"
                  monthly={rb.coachingNet / 12}
                  annual={rb.coachingNet}
                  total={rb.totalRevenue}
                  currency={currency}
                  highlight
                />
              )}
              {inputs.tournamentsEnabled && (
                <RevenueRow
                  label="Events (net)"
                  monthly={rb.tournamentNet / 12}
                  annual={rb.tournamentNet}
                  total={rb.totalRevenue}
                  currency={currency}
                  highlight
                />
              )}
              {inputs.otherRevenueEnabled && (
                <RevenueRow
                  label="Other Revenue"
                  monthly={rb.otherRevenue / 12}
                  annual={rb.otherRevenue}
                  total={rb.totalRevenue}
                  currency={currency}
                  highlight
                />
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2">
                <td className="py-3 text-xs font-bold">Total</td>
                <td className="py-3 text-xs text-right tabular-nums font-bold">
                  {fmt(kpis.totalRevenueMonth)}
                </td>
                <td className="py-3 text-xs text-right tabular-nums font-bold">
                  {fmt(rb.totalRevenue)}
                </td>
                <td className="py-3 text-xs text-right tabular-nums font-bold">
                  100%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────────── */

function ModuleCard({
  icon: Icon,
  title,
  subtitle,
  enabled,
  alwaysOn,
  onToggle,
  readOnly,
  contribution,
  currency = "EUR",
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  enabled: boolean;
  alwaysOn?: boolean;
  onToggle?: (v: boolean) => void;
  readOnly?: boolean;
  contribution?: { gross: number; net: number };
  currency?: string;
  children: React.ReactNode;
}) {
  const fmt = (val: number) => formatCurrency(val, currency);

  return (
    <div
      className={cn(
        "bg-card border rounded-2xl transition-all",
        enabled ? "border-border" : "border-dashed border-muted-foreground/20 opacity-60"
      )}
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "h-9 w-9 rounded-xl flex items-center justify-center",
                enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">{title}</h3>
              <p className="text-[11px] text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {contribution && enabled && (
              <span className="text-xs font-bold tabular-nums text-success">
                {fmt(contribution.net)}/yr
              </span>
            )}
            {!alwaysOn && onToggle && (
              <Switch
                checked={enabled}
                onCheckedChange={onToggle}
                disabled={readOnly}
              />
            )}
          </div>
        </div>
        {enabled && children}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  pct,
  color,
}: {
  label: string;
  value: string;
  pct: string;
  color: string;
}) {
  return (
    <div className="bg-card border rounded-xl p-4">
      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className={cn("text-lg font-bold tabular-nums", color)}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-1">{pct}</p>
    </div>
  );
}

function ReadOnlyMetric({
  label,
  value,
  size = "md",
  color = "text-foreground",
}: {
  label: string;
  value: string;
  size?: "sm" | "md";
  color?: string;
}) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-0.5">
        {label}
      </p>
      <p
        className={cn(
          "font-bold tabular-nums",
          size === "sm" ? "text-sm" : "text-lg",
          color
        )}
      >
        {value}
      </p>
    </div>
  );
}

function NumberField({
  label,
  value,
  suffix,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  suffix?: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-9 text-sm font-medium rounded-lg pr-12"
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

function SliderField({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
  disabled,
  helper,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (v: number) => void;
  disabled?: boolean;
  helper?: string;
}) {
  return (
    <div className={cn("space-y-1.5", disabled && "opacity-60")}>
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="text-sm font-bold tabular-nums">
          {value}
          {suffix && (
            <span className="text-[10px] text-muted-foreground ml-0.5 font-medium">
              {suffix}
            </span>
          )}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => !disabled && onChange(v)}
        disabled={disabled}
        className="py-0.5"
      />
      {helper && (
        <p className="text-[10px] text-muted-foreground">{helper}</p>
      )}
    </div>
  );
}

function RevenueRow({
  label,
  monthly,
  annual,
  total,
  currency,
  highlight,
}: {
  label: string;
  monthly: number;
  annual: number;
  total: number;
  currency: string;
  highlight?: boolean;
}) {
  const fmt = (val: number) => formatCurrency(val, currency);
  const pct = total > 0 ? ((annual / total) * 100).toFixed(0) : "0";

  return (
    <tr className={highlight ? "bg-muted/20" : ""}>
      <td className="py-2.5 text-xs font-medium">{label}</td>
      <td className="py-2.5 text-xs text-right tabular-nums">{fmt(monthly)}</td>
      <td className="py-2.5 text-xs text-right tabular-nums font-semibold">
        {fmt(annual)}
      </td>
      <td className="py-2.5 text-xs text-right tabular-nums text-muted-foreground">
        {pct}%
      </td>
    </tr>
  );
}
