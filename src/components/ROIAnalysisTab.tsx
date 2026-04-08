import { useMemo } from "react";
import { ProjectInputs, Scenario } from "@/lib/types";
import { KPIResult, isSafeValid, calculate5YearProjection } from "@/lib/calculations";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend, Line, ComposedChart, Cell,
} from "recharts";
import {
  Clock, TrendingUp, BarChart3, DollarSign, Users, AlertTriangle, Repeat,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────
interface Investor {
  name: string;
  investment: number;
  equityPct: number;
}

interface ROIAnalysisTabProps {
  inputs: ProjectInputs;
  kpis: KPIResult;
  scenario: Scenario;
  investors?: Investor[];
}

// ─── Helpers ─────────────────────────────────────────────────
const fmt = (val: number) => {
  if (Math.abs(val) >= 1_000_000) return `€${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000) return `€${(val / 1_000).toFixed(0)}K`;
  return `€${val.toFixed(0)}`;
};

// ─── Cash Flow Model ─────────────────────────────────────────
interface CashFlowYear {
  year: string;
  yearNum: number;
  revenue: number;
  opex: number;
  ebitda: number;
  capex: number;
  netCashFlow: number;
  cumulative: number;
}

function buildCashFlowModel(inputs: ProjectInputs, kpis: KPIResult, scenario: Scenario, growthRate = 5): CashFlowYear[] {
  const projection = calculate5YearProjection(inputs, scenario, growthRate);
  const totalCapex = kpis.totalInvestment;
  const rows: CashFlowYear[] = [];
  let cumulative = 0;

  for (let i = 0; i < projection.length; i++) {
    const revenue = projection[i].revenue;
    const ebitda = projection[i].ebitda;
    const opex = revenue - ebitda;
    const capex = i === 0 ? totalCapex : 0;
    const netCashFlow = ebitda - capex;
    cumulative += netCashFlow;

    rows.push({
      year: `Year ${i + 1}`,
      yearNum: i + 1,
      revenue,
      opex,
      ebitda,
      capex,
      netCashFlow,
      cumulative,
    });
  }
  return rows;
}

function calcPayback(rows: CashFlowYear[]): number | null {
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].cumulative >= 0) {
      if (i === 0) {
        // Interpolate within year 1
        const totalNeeded = rows[0].capex;
        if (rows[0].ebitda > 0) {
          return totalNeeded / rows[0].ebitda;
        }
        return null;
      }
      const prevCum = rows[i - 1].cumulative;
      const remaining = Math.abs(prevCum);
      if (rows[i].netCashFlow > 0) {
        return i + remaining / rows[i].netCashFlow;
      }
      return i + 1;
    }
  }
  return null;
}

// ─── Component ───────────────────────────────────────────────
export function ROIAnalysisTab({ inputs, kpis, scenario, investors }: ROIAnalysisTabProps) {
  const cashFlow = useMemo(() => buildCashFlowModel(inputs, kpis, scenario), [inputs, kpis, scenario]);
  const payback = useMemo(() => calcPayback(cashFlow), [cashFlow]);
  const totalCapex = kpis.totalInvestment;

  const cumCashFlow5Y = cashFlow.length === 5 ? cashFlow[4].cumulative : 0;

  // Investor-standard metrics
  const totalReturn5Y = totalCapex > 0 ? (cumCashFlow5Y / totalCapex - 1) * 100 : null;
  const returnMultiple = totalCapex > 0 ? cumCashFlow5Y / totalCapex : null;
  const avgAnnualCashFlow = cashFlow.length > 0
    ? cashFlow.reduce((s, r) => s + r.netCashFlow, 0) / cashFlow.length
    : 0;
  const annualCashYield = totalCapex > 0 ? (avgAnnualCashFlow / totalCapex) * 100 : null;

  // Default investors if none provided
  const displayInvestors: Investor[] = investors && investors.length > 0
    ? investors
    : [
      { name: "Founders", investment: 0, equityPct: 25 },
      { name: "Lead Investor", investment: totalCapex, equityPct: 75 },
    ];

  const fmtMultiple = (v: number) => `${v.toFixed(2)}x`;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ═══ SECTION 1: KPI STRIP ═══ */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPIMetric
          icon={Clock} label="Payback"
          value={payback !== null
            ? (payback < 1
              ? `${Math.round(payback * 12)} months`
              : `${payback.toFixed(1)} yrs`)
            : ">5 yrs"}
          color={payback !== null && payback <= 3 ? "success" : payback !== null && payback <= 5 ? "warning" : "muted"}
          subtitle="Time to recover investment"
        />
        <KPIMetric
          icon={TrendingUp} label="Total Return (5Y)"
          value={totalReturn5Y !== null ? `${totalReturn5Y >= 0 ? "+" : ""}${totalReturn5Y.toFixed(0)}%` : "—"}
          color={totalReturn5Y !== null && totalReturn5Y > 0 ? "success" : "destructive"}
          subtitle="(Cum. Cash Flow / CAPEX) − 1"
        />
        <KPIMetric
          icon={Repeat} label="Return Multiple"
          value={returnMultiple !== null ? fmtMultiple(returnMultiple) : "—"}
          color={returnMultiple !== null && returnMultiple >= 1 ? "success" : "destructive"}
          subtitle="Cum. Cash Flow / CAPEX"
        />
        <KPIMetric
          icon={DollarSign} label="Annual Cash Yield"
          value={annualCashYield !== null ? `${annualCashYield.toFixed(1)}%` : "—"}
          color={annualCashYield !== null && annualCashYield > 0 ? "success" : "destructive"}
          subtitle="Based on average annual operating cash flow"
        />
      </div>

      {/* ═══ SECTION 2: CASH FLOW CHART ═══ */}
      <div className="bg-card border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Cash Flow Projection</h3>
          <span className="text-[10px] text-muted-foreground ml-1">5% annual growth assumed</span>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={cashFlow} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: "hsl(220 9% 46%)" }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={(v: number) => `€${(v / 1000).toFixed(0)}K`}
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
                        <span className="font-semibold">€{entry.value?.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 12, fontSize: 12 }} />
            <Bar dataKey="netCashFlow" name="Net Cash Flow" radius={[4, 4, 0, 0]}>
              {cashFlow.map((entry, i) => (
                <Cell key={i} fill={entry.netCashFlow >= 0 ? "hsl(152 69% 41%)" : "hsl(0 72% 51%)"} />
              ))}
            </Bar>
            <Line
              dataKey="cumulative" name="Cumulative" type="monotone"
              stroke="hsl(217 91% 60%)" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(217 91% 60%)" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ═══ SECTION 3: CASH FLOW TABLE ═══ */}
      <div className="bg-card border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Cash Flow Detail</h3>
          </div>
          <span className="text-[10px] text-muted-foreground">Returns are based on operating cash flow over 5 years</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                {["Year", "Revenue", "OPEX", "EBITDA", "Initial Investment", "Net Cash Flow", "Cumulative"].map(h => (
                  <th key={h} className={cn(
                    "py-2 text-xs text-muted-foreground font-medium",
                    h === "Year" ? "text-left" : "text-right"
                  )}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {cashFlow.map((row) => (
                <tr key={row.year}>
                  <td className="py-2.5 text-xs font-medium">{row.year}</td>
                  <td className="py-2.5 text-xs text-right tabular-nums">{fmt(row.revenue)}</td>
                  <td className="py-2.5 text-xs text-right tabular-nums text-muted-foreground">{fmt(row.opex)}</td>
                  <td className="py-2.5 text-xs text-right tabular-nums font-semibold">{fmt(row.ebitda)}</td>
                  <td className="py-2.5 text-xs text-right tabular-nums text-muted-foreground">{row.capex > 0 ? fmt(row.capex) : "—"}</td>
                  <td className={cn("py-2.5 text-xs text-right tabular-nums font-semibold",
                    row.netCashFlow >= 0 ? "text-success" : "text-destructive"
                  )}>{fmt(row.netCashFlow)}</td>
                  <td className={cn("py-2.5 text-xs text-right tabular-nums font-semibold",
                    row.cumulative >= 0 ? "text-success" : "text-destructive"
                  )}>{fmt(row.cumulative)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ SECTION 4: INVESTOR RETURNS ═══ */}
      <div className="bg-card border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Investor Returns (5-Year)</h3>
          </div>
          <span className="text-[10px] text-muted-foreground">Returns distributed proportionally to equity ownership</span>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 text-xs text-muted-foreground font-medium">Investor</th>
              <th className="text-right py-2 text-xs text-muted-foreground font-medium">Investment (€)</th>
              <th className="text-right py-2 text-xs text-muted-foreground font-medium">Equity (%)</th>
              <th className="text-right py-2 text-xs text-muted-foreground font-medium">Cash Received (5Y)</th>
              <th className="text-right py-2 text-xs text-muted-foreground font-medium">Return Multiple</th>
              <th className="text-right py-2 text-xs text-muted-foreground font-medium">Total Return (%)</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {displayInvestors.map((inv, i) => {
              const cashReceived = cumCashFlow5Y * (inv.equityPct / 100);
              const isFounder = inv.investment === 0;
              const multiple = !isFounder && inv.investment > 0 ? cashReceived / inv.investment : null;
              const totalReturnPct = !isFounder && inv.investment > 0 ? (cashReceived / inv.investment - 1) * 100 : null;

              return (
                <tr key={i} className={isFounder ? "bg-muted/20" : ""}>
                  <td className="py-2.5 text-xs font-medium">
                    {inv.name}
                    {isFounder && <span className="ml-2 text-[10px] text-muted-foreground italic">no cash contribution</span>}
                  </td>
                  <td className="py-2.5 text-xs text-right tabular-nums">
                    {isFounder ? "€0" : fmt(inv.investment)}
                  </td>
                  <td className="py-2.5 text-xs text-right tabular-nums">{inv.equityPct.toFixed(1)}%</td>
                  <td className={cn("py-2.5 text-xs text-right tabular-nums font-semibold",
                    cashReceived >= 0 ? "text-success" : "text-destructive"
                  )}>
                    {fmt(cashReceived)}
                  </td>
                  <td className={cn("py-2.5 text-xs text-right tabular-nums font-semibold",
                    multiple !== null && multiple >= 1 ? "text-success" : multiple !== null ? "text-destructive" : "text-muted-foreground"
                  )}>
                    {multiple !== null ? fmtMultiple(multiple) : "—"}
                  </td>
                  <td className={cn("py-2.5 text-xs text-right tabular-nums font-semibold",
                    totalReturnPct !== null && totalReturnPct >= 0 ? "text-success" : totalReturnPct !== null ? "text-destructive" : "text-muted-foreground"
                  )}>
                    {totalReturnPct !== null ? `${totalReturnPct >= 0 ? "+" : ""}${totalReturnPct.toFixed(0)}%` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2">
              <td className="py-2.5 text-xs font-bold">Total</td>
              <td className="py-2.5 text-xs text-right tabular-nums font-bold">
                {fmt(displayInvestors.reduce((s, inv) => s + inv.investment, 0))}
              </td>
              <td className="py-2.5 text-xs text-right tabular-nums font-bold">100.0%</td>
              <td className={cn("py-2.5 text-xs text-right tabular-nums font-bold",
                cumCashFlow5Y >= 0 ? "text-success" : "text-destructive"
              )}>
                {fmt(cumCashFlow5Y > 0 ? cumCashFlow5Y : 0)}
              </td>
              <td className="py-2.5 text-xs text-right tabular-nums font-bold">
                {returnMultiple !== null ? fmtMultiple(returnMultiple) : "—"}
              </td>
              <td className="py-2.5 text-xs text-right tabular-nums font-bold">
                {totalReturn5Y !== null ? `${totalReturn5Y >= 0 ? "+" : ""}${totalReturn5Y.toFixed(0)}%` : "—"}
              </td>
            </tr>
          </tfoot>
        </table>

        {cumCashFlow5Y < 0 && (
          <div className="flex items-center gap-2 text-warning bg-warning/5 border border-warning/20 rounded-lg px-3 py-2 mt-3">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="text-xs">Investment not recovered within 5 years — cumulative cash flow is negative.</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── KPI Metric Card ─────────────────────────────────────────
function KPIMetric({ icon: Icon, label, value, color, subtitle }: {
  icon: React.ElementType; label: string; value: string;
  color: "success" | "warning" | "destructive" | "muted"; subtitle: string;
}) {
  const colorMap = {
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
    muted: "text-foreground",
  };
  const iconBg = {
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
    muted: "bg-muted text-muted-foreground",
  };

  return (
    <div className="bg-card border rounded-2xl p-5">
      <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center mb-3", iconBg[color])}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">{label}</p>
      <p className={cn("text-2xl font-bold tabular-nums tracking-tight", colorMap[color])}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
}
