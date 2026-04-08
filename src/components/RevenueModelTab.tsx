import { useMemo } from "react";
import { ProjectInputs } from "@/lib/types";
import { KPIResult, RevenueBreakdown } from "@/lib/calculations";
import { formatCurrency, getCurrencySymbol } from "@/lib/currency";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  BarChart3,
  AlertTriangle,
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

  const barData = useMemo(() => {
    const items = [
      { name: "Bookings", revenue: rb.courtRevenue, costs: 0, ebitda: rb.courtRevenue },
    ];
    if (inputs.coachingEnabled) {
      items.push({ name: "Coaching", revenue: rb.coachingRevenue, costs: rb.coachingCost, ebitda: rb.coachingNet });
    }
    if (inputs.tournamentsEnabled) {
      items.push({ name: "Events", revenue: rb.tournamentRevenue, costs: rb.tournamentCost, ebitda: rb.tournamentNet });
    }
    if (inputs.otherRevenueEnabled) {
      items.push({ name: "Other", revenue: rb.otherRevenue, costs: rb.otherCost, ebitda: rb.otherNet });
    }
    return items;
  }, [rb, inputs]);

  const pct = (val: number) =>
    rb.totalRevenue > 0 ? ((val / rb.totalRevenue) * 100).toFixed(1) : "0.0";

  const ebitdaMargin = rb.totalRevenue > 0 ? (rb.totalEbitda / rb.totalRevenue) * 100 : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── KPI Strip ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
        <div className="bg-card border-2 border-foreground/10 rounded-xl p-5">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">
            Total EBITDA
          </p>
          <p className={cn("text-2xl font-extrabold tabular-nums", rb.totalEbitda >= 0 ? "text-success" : "text-destructive")}>
            {fmt(rb.totalEbitda)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {fmt(rb.totalEbitda / 12)}/mo
          </p>
        </div>
        <SummaryCard
          label="EBITDA Margin"
          value={`${ebitdaMargin.toFixed(1)}%`}
          pct={ebitdaMargin >= 20 ? "Healthy" : ebitdaMargin >= 0 ? "Low margin" : "Negative"}
          color={ebitdaMargin >= 20 ? "text-success" : ebitdaMargin >= 0 ? "text-warning" : "text-destructive"}
        />
        <SummaryCard
          label="Add-on EBITDA"
          value={fmt(rb.addOnEbitda)}
          pct={`${rb.addOnPct.toFixed(1)}% of total`}
          color="text-success"
        />
        <SummaryCard
          label="Court Bookings"
          value={fmt(rb.courtRevenue)}
          pct={`${pct(rb.courtRevenue)}% of revenue`}
          color="text-[hsl(217_91%_60%)]"
        />
      </div>

      {/* ── Profitability Warning ── */}
      {rb.totalEbitda < 0 && (
        <div className="flex items-center gap-3 bg-destructive/10 border border-destructive/30 rounded-xl px-5 py-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <div>
            <p className="text-sm font-semibold text-destructive">Not Profitable</p>
            <p className="text-xs text-destructive/80">
              Business model not profitable under current assumptions. EBITDA margin is {ebitdaMargin.toFixed(1)}%.
              Review cost structure or increase revenue sources.
            </p>
          </div>
        </div>
      )}

      {/* ── Capacity Warning ── */}
      {rb.capacityWarning && (
        <div className="flex items-center gap-3 bg-destructive/10 border border-destructive/30 rounded-xl px-5 py-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <div>
            <p className="text-sm font-semibold text-destructive">Capacity Exceeded</p>
            <p className="text-xs text-destructive/80">
              Bookings ({rb.bookingHoursPct.toFixed(0)}%) + Coaching ({rb.coachingHoursPct.toFixed(0)}%) exceeds 100% of court capacity.
              Reduce coaching % to stay within available hours.
            </p>
          </div>
        </div>
      )}

      {/* ── Revenue Charts ── */}
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="bg-card border rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Revenue vs EBITDA by Source (Annual)</h3>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(220 9% 46%)" }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={(v: number) => Math.abs(v) >= 1000 ? `${sym}${(v / 1000).toFixed(0)}K` : `${sym}${v}`}
                tick={{ fontSize: 11, fill: "hsl(220 9% 46%)" }} axisLine={false} tickLine={false}
              />
              <RechartsTooltip
                content={({ active, payload, label }: any) => {
                  if (!active || !payload) return null;
                  return (
                    <div className="bg-card border rounded-xl px-4 py-3 shadow-xl shadow-foreground/5">
                      <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
                      {payload.map((entry: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                          <span className="text-muted-foreground">{entry.name}:</span>
                          <span className="font-semibold">{sym}{entry.value?.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Bar dataKey="revenue" name="Revenue" fill="hsl(217 91% 60%)" radius={[4, 4, 0, 0]} fillOpacity={0.3} />
              <Bar dataKey="ebitda" name="EBITDA" fill="hsl(152 69% 41%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {pieData.length > 0 && (
          <div className="bg-card border rounded-2xl p-6 flex flex-col items-center justify-center">
            <h3 className="text-sm font-semibold mb-3 self-start">Revenue Mix</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} strokeWidth={2} stroke="hsl(var(--card))">
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
                        <p className="tabular-nums">{sym}{d.value?.toLocaleString()}</p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 justify-center mt-2">
              {pieData.map((d, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-[10px] text-muted-foreground">{d.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══ CORE REVENUE (READ-ONLY) ═══ */}
      <ModuleCard icon={Lock} title="Core Revenue (Court Bookings)" subtitle="courts × hours/day × occupancy × price" enabled alwaysOn>
        <div className="grid gap-4 sm:grid-cols-3">
          <ReadOnlyMetric label="Monthly Revenue" value={fmt(kpis.courtRevenueMonth)} />
          <ReadOnlyMetric label="Annual Revenue" value={fmt(rb.courtRevenue)} />
          <ReadOnlyMetric label="Capacity Used" value={`${rb.bookingHoursPct.toFixed(0)}%`} size="sm" />
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">
          {inputs.numberOfCourts} courts × {inputs.openingHoursPerDay}h/day × {kpis.weightedOccupancy.toFixed(0)}% avg occ × {rb.bookingHoursPct.toFixed(0)}% capacity
        </p>
      </ModuleCard>

      {/* ═══ MODULE A: COACHING / CLASSES ═══ */}
      <ModuleCard
        icon={GraduationCap}
        title="Coaching / Classes"
        subtitle="Uses court capacity and replaces standard bookings"
        enabled={inputs.coachingEnabled}
        onToggle={(v) => onInputChange("coachingEnabled", v)}
        readOnly={readOnly}
      >
        {inputs.coachingEnabled && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <SliderField
                label="Court capacity for coaching"
                value={inputs.coachingPctOfHours}
                min={0}
                max={50}
                step={5}
                suffix="%"
                onChange={(v) => onInputChange("coachingPctOfHours", v)}
                disabled={readOnly}
                helper={`Remaining for bookings: ${(100 - inputs.coachingPctOfHours).toFixed(0)}%`}
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
            <ModuleMetrics
              revenue={rb.coachingRevenue}
              costs={rb.coachingCost}
              ebitda={rb.coachingNet}
              currency={currency}
            />
          </div>
        )}
      </ModuleCard>

      {/* ═══ MODULE B: TOURNAMENTS / EVENTS ═══ */}
      <ModuleCard
        icon={Trophy}
        title="Tournaments / Events"
        subtitle="Additional revenue not tied to regular bookings"
        enabled={inputs.tournamentsEnabled}
        onToggle={(v) => onInputChange("tournamentsEnabled", v)}
        readOnly={readOnly}
      >
        {inputs.tournamentsEnabled && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField label="Events per month" value={inputs.eventsPerMonth} suffix="/mo" onChange={(v) => onInputChange("eventsPerMonth", v)} disabled={readOnly} />
              <NumberField label="Avg revenue per event" value={inputs.avgRevenuePerEvent} suffix={sym} onChange={(v) => onInputChange("avgRevenuePerEvent", v)} disabled={readOnly} />
              <NumberField label="Avg cost per event" value={inputs.avgCostPerEvent} suffix={sym} onChange={(v) => onInputChange("avgCostPerEvent", v)} disabled={readOnly} />
            </div>
            <ModuleMetrics
              revenue={rb.tournamentRevenue}
              costs={rb.tournamentCost}
              ebitda={rb.tournamentNet}
              currency={currency}
            />
          </div>
        )}
      </ModuleCard>

      {/* ═══ MODULE C: OTHER REVENUE ═══ */}
      <ModuleCard
        icon={Store}
        title="Other Revenue"
        subtitle="Ancillary revenue (F&B, shop, memberships)"
        enabled={inputs.otherRevenueEnabled}
        onToggle={(v) => onInputChange("otherRevenueEnabled", v)}
        readOnly={readOnly}
      >
        {inputs.otherRevenueEnabled && (
          <div className="space-y-4">
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">Revenue Mode</Label>
              <Select
                value={inputs.otherRevenueMode}
                onValueChange={(v) => onInputChange("otherRevenueMode", v as any)}
                disabled={readOnly}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed Monthly (Pro Shop + F&B + Memberships)</SelectItem>
                  <SelectItem value="pctOfBookings">% of Booking Revenue</SelectItem>
                  <SelectItem value="perBooking">Revenue per Booking ({sym})</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {inputs.otherRevenueMode === "fixed" && (
              <div className="grid gap-4 sm:grid-cols-3">
                <NumberField label="Pro Shop / Month" value={inputs.proshopRevenue} suffix={`${sym}/mo`} onChange={(v) => onInputChange("proshopRevenue", v)} disabled={readOnly} />
                <NumberField label="F&B / Month" value={inputs.fAndBRevenue} suffix={`${sym}/mo`} onChange={(v) => onInputChange("fAndBRevenue", v)} disabled={readOnly} />
                <NumberField label="Memberships / Month" value={inputs.membershipFees} suffix={`${sym}/mo`} onChange={(v) => onInputChange("membershipFees", v)} disabled={readOnly} />
              </div>
            )}

            {inputs.otherRevenueMode === "pctOfBookings" && (
              <SliderField
                label="% of Booking Revenue"
                value={inputs.otherRevenuePctOfBookings}
                min={0}
                max={30}
                step={1}
                suffix="%"
                onChange={(v) => onInputChange("otherRevenuePctOfBookings", v)}
                disabled={readOnly}
                helper={`≈ ${fmt(rb.otherRevenue / 12)}/mo based on current bookings`}
              />
            )}

            {inputs.otherRevenueMode === "perBooking" && (
              <NumberField
                label="Revenue per booking"
                value={inputs.otherRevenuePerBooking}
                suffix={`${sym}/booking`}
                onChange={(v) => onInputChange("otherRevenuePerBooking", v)}
                disabled={readOnly}
              />
            )}

            <ModuleMetrics
              revenue={rb.otherRevenue}
              costs={rb.otherCost}
              ebitda={rb.otherNet}
              currency={currency}
            />
          </div>
        )}
      </ModuleCard>

      {/* ── Summary Table ── */}
      <div className="bg-card border-2 border-primary/20 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Total Revenue & EBITDA Summary</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 text-xs text-muted-foreground font-medium">Source</th>
                <th className="text-right py-2 text-xs text-muted-foreground font-medium">Revenue</th>
                <th className="text-right py-2 text-xs text-muted-foreground font-medium">Costs</th>
                <th className="text-right py-2 text-xs text-muted-foreground font-medium">EBITDA</th>
                <th className="text-right py-2 text-xs text-muted-foreground font-medium">% Rev</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <SummaryRow label="Court Bookings" revenue={rb.courtRevenue} costs={0} ebitda={rb.courtRevenue} total={rb.totalRevenue} currency={currency} />
              {inputs.coachingEnabled && (
                <SummaryRow label="Coaching" revenue={rb.coachingRevenue} costs={rb.coachingCost} ebitda={rb.coachingNet} total={rb.totalRevenue} currency={currency} highlight />
              )}
              {inputs.tournamentsEnabled && (
                <SummaryRow label="Events" revenue={rb.tournamentRevenue} costs={rb.tournamentCost} ebitda={rb.tournamentNet} total={rb.totalRevenue} currency={currency} highlight />
              )}
              {inputs.otherRevenueEnabled && (
                <SummaryRow label="Other" revenue={rb.otherRevenue} costs={rb.otherCost} ebitda={rb.otherNet} total={rb.totalRevenue} currency={currency} highlight />
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2">
                <td className="py-3 text-xs font-bold">Total</td>
                <td className="py-3 text-xs text-right tabular-nums font-bold">{fmt(rb.totalRevenue)}</td>
                <td className="py-3 text-xs text-right tabular-nums font-bold text-destructive">
                  -{fmt(rb.coachingCost + rb.tournamentCost + rb.otherCost)}
                </td>
                <td className="py-3 text-xs text-right tabular-nums font-bold text-success">
                  {fmt(rb.courtRevenue + rb.coachingNet + rb.tournamentNet + rb.otherNet)}
                </td>
                <td className="py-3 text-xs text-right tabular-nums font-bold">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────────── */

function ModuleMetrics({
  revenue,
  costs,
  ebitda,
  currency,
}: {
  revenue: number;
  costs: number;
  ebitda: number;
  currency: string;
}) {
  const fmt = (val: number) => formatCurrency(val, currency);
  return (
    <div className="grid gap-3 sm:grid-cols-3 bg-muted/30 rounded-xl p-4">
      <ReadOnlyMetric label="Revenue" value={fmt(revenue)} size="sm" />
      <ReadOnlyMetric label="Costs" value={costs > 0 ? `-${fmt(costs)}` : fmt(0)} size="sm" color={costs > 0 ? "text-destructive" : "text-muted-foreground"} />
      <ReadOnlyMetric label="Add-on EBITDA" value={fmt(ebitda)} size="sm" color={ebitda >= 0 ? "text-success" : "text-destructive"} />
    </div>
  );
}

function ModuleCard({
  icon: Icon,
  title,
  subtitle,
  enabled,
  alwaysOn,
  onToggle,
  readOnly,
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  enabled: boolean;
  alwaysOn?: boolean;
  onToggle?: (v: boolean) => void;
  readOnly?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("bg-card border rounded-2xl transition-all", enabled ? "border-border" : "border-dashed border-muted-foreground/20 opacity-60")}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">{title}</h3>
              <p className="text-[11px] text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          {!alwaysOn && onToggle && (
            <Switch checked={enabled} onCheckedChange={onToggle} disabled={readOnly} />
          )}
        </div>
        {enabled && children}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, pct, color }: { label: string; value: string; pct: string; color: string }) {
  return (
    <div className="bg-card border rounded-xl p-4">
      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">{label}</p>
      <p className={cn("text-lg font-bold tabular-nums", color)}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-1">{pct}</p>
    </div>
  );
}

function ReadOnlyMetric({ label, value, size = "md", color = "text-foreground" }: { label: string; value: string; size?: "sm" | "md"; color?: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{label}</p>
      <p className={cn("font-bold tabular-nums", size === "sm" ? "text-sm" : "text-lg", color)}>{value}</p>
    </div>
  );
}

function NumberField({ label, value, suffix, onChange, disabled }: { label: string; value: number; suffix?: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="h-9 text-sm font-medium rounded-lg pr-12" />
        {suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium">{suffix}</span>}
      </div>
    </div>
  );
}

function SliderField({ label, value, min, max, step, suffix, onChange, disabled, helper }: { label: string; value: number; min: number; max: number; step: number; suffix?: string; onChange: (v: number) => void; disabled?: boolean; helper?: string }) {
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
      {helper && <p className="text-[10px] text-muted-foreground">{helper}</p>}
    </div>
  );
}

function SummaryRow({ label, revenue, costs, ebitda, total, currency, highlight }: { label: string; revenue: number; costs: number; ebitda: number; total: number; currency: string; highlight?: boolean }) {
  const fmt = (val: number) => formatCurrency(val, currency);
  const pct = total > 0 ? ((revenue / total) * 100).toFixed(0) : "0";
  return (
    <tr className={highlight ? "bg-muted/20" : ""}>
      <td className="py-2.5 text-xs font-medium">{label}</td>
      <td className="py-2.5 text-xs text-right tabular-nums">{fmt(revenue)}</td>
      <td className="py-2.5 text-xs text-right tabular-nums text-destructive">{costs > 0 ? `-${fmt(costs)}` : "—"}</td>
      <td className="py-2.5 text-xs text-right tabular-nums font-semibold text-success">{fmt(ebitda)}</td>
      <td className="py-2.5 text-xs text-right tabular-nums text-muted-foreground">{pct}%</td>
    </tr>
  );
}
