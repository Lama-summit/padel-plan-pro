import { useMemo, useState, useEffect } from "react";
import { ProjectInputs, RevenueLineItem, createRevenueLineItem } from "@/lib/types";
import { KPIResult } from "@/lib/calculations";
import { formatCurrency, getCurrencySymbol } from "@/lib/currency";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  CalendarDays,
  Store,
  TrendingUp,
  BarChart3,
  AlertTriangle,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RevenueModelTabProps {
  inputs: ProjectInputs;
  kpis: KPIResult;
  onInputChange: (key: keyof ProjectInputs, value: string | number | boolean | RevenueLineItem[]) => void;
  readOnly: boolean;
  currency?: string;
}

const PIE_COLORS = [
  "hsl(225 53% 22%)",
  "hsl(152 57% 24%)",
  "hsl(38 92% 50%)",
  "hsl(353 78% 44%)",
  "hsl(210 67% 45%)",
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
      { name: "Coaching", value: rb.coachingRevenue, color: PIE_COLORS[1] },
      { name: "Tournaments", value: rb.tournamentsRevenue, color: PIE_COLORS[2] },
      { name: "Events", value: rb.eventsRevenue, color: PIE_COLORS[3] },
      { name: "Other Revenues", value: rb.otherRevenue, color: PIE_COLORS[4] },
    ];
    return items.filter((item) => item.value > 0);
  }, [rb]);

  const barData = useMemo(() => ([
    { name: "Bookings", revenue: rb.courtRevenue, costs: rb.courtDirectCost + rb.courtAllocatedIndirect, ebitda: rb.courtEbitda },
    { name: "Coaching", revenue: rb.coachingRevenue, costs: rb.coachingCost + rb.coachingAllocatedIndirect, ebitda: rb.coachingEbitda },
    { name: "Tournaments", revenue: rb.tournamentsRevenue, costs: rb.tournamentsCost + rb.tournamentsAllocatedIndirect, ebitda: rb.tournamentsEbitda },
    { name: "Events", revenue: rb.eventsRevenue, costs: rb.eventsCost + rb.eventsAllocatedIndirect, ebitda: rb.eventsEbitda },
    { name: "Other", revenue: rb.otherRevenue, costs: rb.otherCost + rb.otherAllocatedIndirect, ebitda: rb.otherEbitda },
  ].filter((item) => item.revenue > 0 || item.costs > 0)), [rb]);

  const ebitdaMargin = rb.totalRevenue > 0 ? (rb.totalEbitda / rb.totalRevenue) * 100 : 0;

  const updateRevenueItems = (nextItems: RevenueLineItem[]) => {
    onInputChange("otherRevenueItems", nextItems);
  };

  const handleRevenueItemChange = (itemId: string, key: keyof RevenueLineItem, value: string) => {
    const nextItems = inputs.otherRevenueItems.map((item) => (
      item.id === itemId
        ? {
            ...item,
            [key]: key === "name" ? value : Number(value) || 0,
          }
        : item
    ));
    updateRevenueItems(nextItems);
  };

  const handleAddRevenueItem = () => {
    updateRevenueItems([
      ...inputs.otherRevenueItems,
      createRevenueLineItem(`Revenue ${inputs.otherRevenueItems.length + 1}`),
    ]);
  };

  const handleRemoveRevenueItem = (itemId: string) => {
    updateRevenueItems(inputs.otherRevenueItems.filter((item) => item.id !== itemId));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Total Annual Revenue" value={fmt(rb.totalRevenue)} hint={`${fmt(kpis.totalRevenueMonth)}/mo`} color="text-primary" />
        <MetricCard label="Total EBITDA" value={fmt(rb.totalEbitda)} hint={`${fmt(rb.totalEbitda / 12)}/mo`} color={rb.totalEbitda >= 0 ? "text-success" : "text-destructive"} />
        <MetricCard label="EBITDA Margin" value={`${ebitdaMargin.toFixed(1)}%`} hint={ebitdaMargin >= 20 ? "Healthy" : ebitdaMargin >= 0 ? "Low margin" : "Negative"} color={ebitdaMargin >= 20 ? "text-success" : ebitdaMargin >= 0 ? "text-warning" : "text-destructive"} />
        <MetricCard label="Add-on EBITDA" value={fmt(rb.addOnEbitda)} hint={`${rb.addOnPct.toFixed(1)}% of total`} color={rb.addOnEbitda >= 0 ? "text-success" : "text-destructive"} />
        <MetricCard label="Court Bookings" value={fmt(rb.courtRevenue)} hint={`${rb.totalRevenue > 0 ? ((rb.courtRevenue / rb.totalRevenue) * 100).toFixed(1) : "0.0"}% of revenue`} color="text-primary" />
      </div>

      {rb.totalEbitda < 0 && (
        <WarningCard
          title="Not Profitable"
          body={`Business model not profitable under current assumptions. EBITDA margin is ${ebitdaMargin.toFixed(1)}%. Review cost structure or increase revenue sources.`}
        />
      )}

      {rb.capacityWarning && (
        <WarningCard
          title="Capacity Exceeded"
          body={`Bookings (${rb.bookingHoursPct.toFixed(0)}%) + Coaching (${rb.coachingHoursPct.toFixed(0)}%) exceeds 100% of court capacity. Reduce coaching hours/day to stay within available capacity.`}
        />
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="bg-card border rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Revenue vs EBITDA by Source (Annual)</h3>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={barData} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(220 9% 46%)" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v: number) => Math.abs(v) >= 1000 ? `${sym}${(v / 1000).toFixed(0)}K` : `${sym}${v}`} tick={{ fontSize: 11, fill: "hsl(220 9% 46%)" }} axisLine={false} tickLine={false} />
              <RechartsTooltip content={({ active, payload, label }: any) => {
                if (!active || !payload) return null;
                return (
                  <div className="bg-card border rounded-xl px-4 py-3 shadow-xl shadow-foreground/5">
                    <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
                    {payload.map((entry: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-muted-foreground">{entry.name}:</span>
                        <span className="font-semibold">{fmt(entry.value)}</span>
                      </div>
                    ))}
                  </div>
                );
              }} />
              <Bar dataKey="revenue" name="Revenue" fill="hsl(225 53% 22%)" radius={[4, 4, 0, 0]} fillOpacity={0.3} />
              <Bar dataKey="ebitda" name="EBITDA" fill="hsl(152 57% 24%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {pieData.length > 0 && (
          <div className="bg-card border rounded-2xl p-6 flex flex-col items-center justify-center">
            <h3 className="text-sm font-semibold mb-3 self-start">Revenue Mix</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={78}
                  strokeWidth={2}
                  stroke="hsl(var(--card))"
                  labelLine={false}
                  label={(props: any) => revenuePieLabel(props, rb.totalRevenue)}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip content={({ active, payload }: any) => {
                  if (!active || !payload?.[0]) return null;
                  const entry = payload[0];
                  const pct = rb.totalRevenue > 0 ? (entry.value / rb.totalRevenue) * 100 : 0;
                  return (
                    <div className="bg-card border rounded-lg px-3 py-2 shadow-lg text-xs">
                      <p className="font-medium">{entry.name}</p>
                      <p className="tabular-nums">{fmt(entry.value)}</p>
                      <p className="text-muted-foreground">{pct.toFixed(1)}%</p>
                    </div>
                  );
                }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 justify-center mt-2">
              {pieData.map((item) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-[10px] text-muted-foreground">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ModuleCard icon={Lock} title="Core Bookings" subtitle="Read-only base business from courts, occupancy and pricing" enabled alwaysOn>
        <div className="grid gap-4 sm:grid-cols-3 mb-3">
          <ReadOnlyMetric label="Monthly Revenue" value={fmt(kpis.courtRevenueMonth)} color="text-primary" />
          <ReadOnlyMetric label="Annual Revenue" value={fmt(rb.courtRevenue)} color="text-primary" />
          <ReadOnlyMetric label="Capacity Used" value={`${rb.bookingHoursPct.toFixed(0)}%`} size="sm" color="text-primary" />
        </div>
        <ModuleMetrics revenue={rb.courtRevenue} directCost={rb.courtDirectCost} allocatedIndirect={rb.courtAllocatedIndirect} ebitda={rb.courtEbitda} ebitdaMargin={rb.courtEbitdaMargin} currency={currency} />
        <p className="text-[11px] text-muted-foreground mt-3">
          {inputs.numberOfCourts} courts × {inputs.openingHoursPerDay}h/day × {kpis.weightedOccupancy.toFixed(0)}% avg occ
        </p>
      </ModuleCard>

      <ModuleCard icon={GraduationCap} title="Coaching" subtitle="Configured from Key Drivers and summarized here" enabled={inputs.coachingEnabled} onToggle={(value) => onInputChange("coachingEnabled", value)} readOnly={readOnly}>
        {inputs.coachingEnabled && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 mb-3">
              <ReadOnlyMetric label="Hours / Day" value={`${inputs.coachingHoursPerDay.toFixed(1)} hrs`} color="text-primary" />
              <ReadOnlyMetric label="Capacity Used" value={`${rb.coachingHoursPct.toFixed(0)}%`} size="sm" color="text-primary" />
            </div>
            <ModuleMetrics revenue={rb.coachingRevenue} directCost={rb.coachingCost} allocatedIndirect={rb.coachingAllocatedIndirect} ebitda={rb.coachingEbitda} ebitdaMargin={rb.coachingEbitdaMargin} currency={currency} />
            <p className="text-[11px] text-muted-foreground mt-3">Use Key Drivers to adjust coaching hours/day, price per hour and coach cost share.</p>
          </div>
        )}
      </ModuleCard>

      <ModuleCard icon={Store} title="Other Revenues" subtitle="Flexible monthly revenue lines with their own monthly costs" enabled={inputs.otherRevenueEnabled} onToggle={(value) => onInputChange("otherRevenueEnabled", value)} readOnly={readOnly}>
        {inputs.otherRevenueEnabled && (
          <div className="space-y-4">
            <div className="grid gap-3">
              {inputs.otherRevenueItems.map((item) => (
                <div key={item.id} className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_auto] items-end">
                  <TextField label="Revenue" value={item.name} onChange={(value) => handleRevenueItemChange(item.id, "name", value)} disabled={readOnly} />
                  <NumberField label={`${sym} / month`} value={item.monthlyRevenue} suffix={sym} onChange={(value) => handleRevenueItemChange(item.id, "monthlyRevenue", value)} disabled={readOnly} />
                  <NumberField label={`${sym} / month costs`} value={item.monthlyCost} suffix={sym} onChange={(value) => handleRevenueItemChange(item.id, "monthlyCost", value)} disabled={readOnly} />
                  <Button variant="outline" className="h-9 rounded-lg" onClick={() => handleRemoveRevenueItem(item.id)} disabled={readOnly || inputs.otherRevenueItems.length <= 1}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="outline" className="gap-2 rounded-xl" onClick={handleAddRevenueItem} disabled={readOnly}>
              <Plus className="h-4 w-4" />
              Add revenue line
            </Button>
            <ModuleMetrics revenue={rb.otherRevenue} directCost={rb.otherCost} allocatedIndirect={rb.otherAllocatedIndirect} ebitda={rb.otherEbitda} ebitdaMargin={rb.otherEbitdaMargin} currency={currency} />
          </div>
        )}
      </ModuleCard>

      <ModuleCard icon={Trophy} title="Tournaments" subtitle="Recurring competitive activity with revenue and direct event costs" enabled={inputs.tournamentsEnabled} onToggle={(value) => onInputChange("tournamentsEnabled", value)} readOnly={readOnly}>
        {inputs.tournamentsEnabled && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField label="Tournaments / Month" value={inputs.tournamentsPerMonth} suffix="/mo" onChange={(value) => onInputChange("tournamentsPerMonth", value)} disabled={readOnly} />
              <NumberField label="Revenue / Tournament" value={inputs.tournamentRevenuePerEvent} suffix={sym} onChange={(value) => onInputChange("tournamentRevenuePerEvent", value)} disabled={readOnly} />
              <NumberField label="Cost / Tournament" value={inputs.tournamentCostPerEvent} suffix={sym} onChange={(value) => onInputChange("tournamentCostPerEvent", value)} disabled={readOnly} />
            </div>
            <ModuleMetrics revenue={rb.tournamentsRevenue} directCost={rb.tournamentsCost} allocatedIndirect={rb.tournamentsAllocatedIndirect} ebitda={rb.tournamentsEbitda} ebitdaMargin={rb.tournamentsEbitdaMargin} currency={currency} />
          </div>
        )}
      </ModuleCard>

      <ModuleCard icon={CalendarDays} title="Events" subtitle="Corporate or social events tracked separately from tournaments" enabled={inputs.eventsEnabled} onToggle={(value) => onInputChange("eventsEnabled", value)} readOnly={readOnly}>
        {inputs.eventsEnabled && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField label="Events / Month" value={inputs.eventsPerMonth} suffix="/mo" onChange={(value) => onInputChange("eventsPerMonth", value)} disabled={readOnly} />
              <NumberField label="Revenue / Event" value={inputs.eventRevenuePerEvent} suffix={sym} onChange={(value) => onInputChange("eventRevenuePerEvent", value)} disabled={readOnly} />
              <NumberField label="Cost / Event" value={inputs.eventCostPerEvent} suffix={sym} onChange={(value) => onInputChange("eventCostPerEvent", value)} disabled={readOnly} />
            </div>
            <ModuleMetrics revenue={rb.eventsRevenue} directCost={rb.eventsCost} allocatedIndirect={rb.eventsAllocatedIndirect} ebitda={rb.eventsEbitda} ebitdaMargin={rb.eventsEbitdaMargin} currency={currency} />
          </div>
        )}
      </ModuleCard>

      <div className="bg-card border-2 border-primary/20 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">P&L by Business Line</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 text-xs text-muted-foreground font-medium">Source</th>
                <th className="text-right py-2 text-xs text-muted-foreground font-medium">Revenue</th>
                <th className="text-right py-2 text-xs text-muted-foreground font-medium">Direct Costs</th>
                <th className="text-right py-2 text-xs text-muted-foreground font-medium">Indirect (alloc.)</th>
                <th className="text-right py-2 text-xs text-muted-foreground font-medium">EBITDA</th>
                <th className="text-right py-2 text-xs text-muted-foreground font-medium">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <SummaryRow label="Court Bookings" revenue={rb.courtRevenue} directCost={rb.courtDirectCost} indirectCost={rb.courtAllocatedIndirect} ebitda={rb.courtEbitda} margin={rb.courtEbitdaMargin} currency={currency} />
              {inputs.coachingEnabled && <SummaryRow label="Coaching" revenue={rb.coachingRevenue} directCost={rb.coachingCost} indirectCost={rb.coachingAllocatedIndirect} ebitda={rb.coachingEbitda} margin={rb.coachingEbitdaMargin} currency={currency} highlight />}
              {inputs.tournamentsEnabled && <SummaryRow label="Tournaments" revenue={rb.tournamentsRevenue} directCost={rb.tournamentsCost} indirectCost={rb.tournamentsAllocatedIndirect} ebitda={rb.tournamentsEbitda} margin={rb.tournamentsEbitdaMargin} currency={currency} highlight />}
              {inputs.eventsEnabled && <SummaryRow label="Events" revenue={rb.eventsRevenue} directCost={rb.eventsCost} indirectCost={rb.eventsAllocatedIndirect} ebitda={rb.eventsEbitda} margin={rb.eventsEbitdaMargin} currency={currency} highlight />}
              {inputs.otherRevenueEnabled && <SummaryRow label="Other Revenues" revenue={rb.otherRevenue} directCost={rb.otherCost} indirectCost={rb.otherAllocatedIndirect} ebitda={rb.otherEbitda} margin={rb.otherEbitdaMargin} currency={currency} highlight />}
            </tbody>
            <tfoot>
              <tr className="border-t-2">
                <td className="py-3 text-xs font-bold">Total</td>
                <td className="py-3 text-xs text-right tabular-nums font-bold">{fmt(rb.totalRevenue)}</td>
                <td className="py-3 text-xs text-right tabular-nums font-bold text-destructive">{rb.totalDirectCosts > 0 ? `-${fmt(rb.totalDirectCosts)}` : "—"}</td>
                <td className="py-3 text-xs text-right tabular-nums font-bold text-destructive">{rb.totalIndirectCosts > 0 ? `-${fmt(rb.totalIndirectCosts)}` : "—"}</td>
                <td className={cn("py-3 text-xs text-right tabular-nums font-bold", rb.totalEbitda >= 0 ? "text-success" : "text-destructive")}>{fmt(rb.totalEbitda)}</td>
                <td className={cn("py-3 text-xs text-right tabular-nums font-bold", rb.totalEbitda >= 0 ? "text-success" : "text-destructive")}>{rb.totalRevenue > 0 ? `${(rb.totalEbitda / rb.totalRevenue * 100).toFixed(1)}%` : "—"}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function revenuePieLabel(props: any, total: number) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
  const RADIAN = Math.PI / 180;
  const pct = total > 0 ? percent * 100 : 0;
  if (pct < 1) return null;

  // Large segments: label inside the donut ring
  if (pct >= 8) {
    const radius = innerRadius + (outerRadius - innerRadius) / 2;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
        {pct.toFixed(0)}%
      </text>
    );
  }

  // Small segments: label outside with elbow connector
  const cos = Math.cos(-midAngle * RADIAN);
  const sin = Math.sin(-midAngle * RADIAN);

  const sx = cx + outerRadius * cos;
  const sy = cy + outerRadius * sin;
  const mx = cx + (outerRadius + 16) * cos;
  const my = cy + (outerRadius + 16) * sin;
  const ex = mx + (cos >= 0 ? 14 : -14);
  const ey = my;
  const textAnchor = cos >= 0 ? "start" : "end";
  const textX = ex + (cos >= 0 ? 4 : -4);

  return (
    <g>
      <path
        d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
        stroke="hsl(220 9% 66%)"
        fill="none"
        strokeWidth={1}
      />
      <text x={textX} y={ey} fill="hsl(220 9% 46%)" textAnchor={textAnchor} dominantBaseline="central" fontSize={11} fontWeight={600}>
        {pct.toFixed(0)}%
      </text>
    </g>
  );
}

function WarningCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex items-center gap-3 bg-destructive/10 border border-destructive/30 rounded-xl px-5 py-3">
      <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
      <div>
        <p className="text-sm font-semibold text-destructive">{title}</p>
        <p className="text-xs text-destructive/80">{body}</p>
      </div>
    </div>
  );
}

function ModuleMetrics({
  revenue,
  directCost,
  allocatedIndirect,
  ebitda,
  ebitdaMargin,
  currency,
}: {
  revenue: number;
  directCost: number;
  allocatedIndirect: number;
  ebitda: number;
  ebitdaMargin: number;
  currency: string;
}) {
  const fmt = (val: number) => formatCurrency(val, currency);
  return (
    <div className="grid gap-3 sm:grid-cols-5 bg-muted/30 rounded-xl p-4">
      <ReadOnlyMetric label="Revenue" value={fmt(revenue)} size="sm" color="text-primary" />
      <ReadOnlyMetric label="Direct Costs" value={directCost > 0 ? `-${fmt(directCost)}` : "—"} size="sm" color={directCost > 0 ? "text-destructive" : "text-muted-foreground"} />
      <ReadOnlyMetric label="Indirect (alloc.)" value={allocatedIndirect > 0 ? `-${fmt(allocatedIndirect)}` : "—"} size="sm" color={allocatedIndirect > 0 ? "text-destructive" : "text-muted-foreground"} />
      <ReadOnlyMetric label="EBITDA" value={fmt(ebitda)} size="sm" color={ebitda >= 0 ? "text-success" : "text-destructive"} />
      <ReadOnlyMetric label="EBITDA Margin" value={`${ebitdaMargin.toFixed(1)}%`} size="sm" color={ebitdaMargin >= 0 ? "text-success" : "text-destructive"} />
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
  onToggle?: (value: boolean) => void;
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
          {!alwaysOn && onToggle && <Switch checked={enabled} onCheckedChange={onToggle} disabled={readOnly} />}
        </div>
        {enabled && children}
      </div>
    </div>
  );
}

function MetricCard({ label, value, hint, color = "text-primary" }: { label: string; value: string; hint: string; color?: string }) {
  return (
    <div className="bg-card border rounded-xl p-5">
      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">{label}</p>
      <p className={cn("text-xl md:text-2xl font-extrabold tabular-nums", color)}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>
    </div>
  );
}

function ReadOnlyMetric({ label, value, size = "md", color = "text-primary" }: { label: string; value: string; size?: "sm" | "md"; color?: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-0.5">{label}</p>
      <p className={cn("font-extrabold tabular-nums", size === "sm" ? "text-base" : "text-2xl", color)}>{value}</p>
    </div>
  );
}

function NumberField({ label, value, suffix, onChange, disabled }: { label: string; value: number; suffix?: string; onChange: (value: string) => void; disabled?: boolean }) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => { setLocal(String(value)); }, [value]);
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input type="number" value={local} onChange={(e) => setLocal(e.target.value)}
          onBlur={() => onChange(local === "" ? "0" : local)}
          disabled={disabled} className="h-9 text-sm font-medium rounded-lg pr-12" />
        {suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium">{suffix}</span>}
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="h-9 text-sm font-medium rounded-lg" />
    </div>
  );
}

function SummaryRow({ label, revenue, directCost, indirectCost, ebitda, margin, currency, highlight }: {
  label: string; revenue: number; directCost: number; indirectCost: number; ebitda: number; margin: number; currency: string; highlight?: boolean;
}) {
  const fmt = (val: number) => formatCurrency(val, currency);
  return (
    <tr className={highlight ? "bg-muted/20" : ""}>
      <td className="py-2.5 text-xs font-medium">{label}</td>
      <td className="py-2.5 text-xs text-right tabular-nums">{fmt(revenue)}</td>
      <td className="py-2.5 text-xs text-right tabular-nums text-destructive">{directCost > 0 ? `-${fmt(directCost)}` : "—"}</td>
      <td className="py-2.5 text-xs text-right tabular-nums text-muted-foreground">{indirectCost > 0 ? `-${fmt(indirectCost)}` : "—"}</td>
      <td className={cn("py-2.5 text-xs text-right tabular-nums font-semibold", ebitda >= 0 ? "text-success" : "text-destructive")}>{fmt(ebitda)}</td>
      <td className={cn("py-2.5 text-xs text-right tabular-nums font-semibold", margin >= 0 ? "text-success" : "text-destructive")}>{margin.toFixed(1)}%</td>
    </tr>
  );
}
