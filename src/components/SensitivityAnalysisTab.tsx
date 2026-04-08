import { useMemo } from "react";
import { ProjectInputs, Scenario } from "@/lib/types";
import {
  calculateFullSensitivity,
  calculateDriverDeltas,
  SensitivityVariable,
  DriverDelta,
} from "@/lib/calculations";
import { formatCurrency, getCurrencySymbol } from "@/lib/currency";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import {
  Zap,
  BarChart3,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Clock,
  Repeat,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SensitivityAnalysisTabProps {
  inputs: ProjectInputs;
  scenario: Scenario;
  currency?: string;
}

export function SensitivityAnalysisTab({
  inputs,
  scenario,
  currency = "EUR",
}: SensitivityAnalysisTabProps) {
  const sym = getCurrencySymbol(currency);
  const fmt = (val: number) => formatCurrency(val, currency);

  const sensitivity = useMemo(
    () => calculateFullSensitivity(inputs, scenario),
    [inputs, scenario]
  );

  const driverDeltas = useMemo(
    () => calculateDriverDeltas(inputs, scenario),
    [inputs, scenario]
  );

  // Build chart data (sorted by absolute EBITDA impact, descending)
  const chartData = sensitivity.map((s) => ({
    name: `${s.label} (${s.change})`,
    ebitda: s.ebitdaImpact,
    fill:
      s.ebitdaImpact >= 0 ? "hsl(152 69% 41%)" : "hsl(0 72% 51%)",
  }));

  const maxAbsImpact = Math.max(
    ...sensitivity.map((s) => Math.abs(s.ebitdaImpact)),
    1
  );

  // Generate interpretation text
  const interpretation = useMemo(() => {
    if (sensitivity.length === 0) return "";
    const top = sensitivity[0];
    const second = sensitivity.length > 1 ? sensitivity[1] : null;

    let text = `**${top.label}** is the main driver of profitability`;
    if (second) {
      text += `, followed by **${second.label}**`;
    }
    text += ".";

    // Add insight about cost drivers
    const costDriver = sensitivity.find((s) => s.ebitdaImpact < 0);
    if (costDriver) {
      text += ` Increasing ${costDriver.label.toLowerCase()} reduces EBITDA by ${fmt(Math.abs(costDriver.ebitdaImpact))}/year.`;
    }

    return text;
  }, [sensitivity, fmt]);

  const fmtDelta = (val: number, prefix = "") => {
    const sign = val >= 0 ? "+" : "";
    if (Math.abs(val) >= 1000)
      return `${sign}${prefix}${sym}${(val / 1000).toFixed(0)}K`;
    return `${sign}${prefix}${sym}${val.toFixed(0)}`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Interpretation Block ── */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Lightbulb className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
              Key Insight
            </p>
            <p
              className="text-sm leading-relaxed text-foreground"
              dangerouslySetInnerHTML={{
                __html: interpretation.replace(
                  /\*\*(.*?)\*\*/g,
                  '<strong class="font-semibold">$1</strong>'
                ),
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Horizontal Bar Chart: EBITDA Impact ── */}
      <div className="bg-card border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="h-4 w-4 text-accent-foreground" />
          <h3 className="text-sm font-semibold">
            EBITDA Impact by Variable
          </h3>
        </div>
        <p className="text-[11px] text-muted-foreground mb-5 ml-6">
          Impact of changing one variable at a time · Base scenario as
          reference · sorted by magnitude
        </p>

        <ResponsiveContainer width="100%" height={sensitivity.length * 64 + 40}>
          <BarChart
            data={chartData}
            layout="vertical"
            barCategoryGap="30%"
            margin={{ left: 0, right: 30, top: 5, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(220 13% 91%)"
              horizontal={false}
            />
            <XAxis
              type="number"
              tickFormatter={(v: number) =>
                Math.abs(v) >= 1000
                  ? `${v >= 0 ? "+" : ""}${sym}${(v / 1000).toFixed(0)}K`
                  : `${v >= 0 ? "+" : ""}${sym}${v}`
              }
              tick={{ fontSize: 11, fill: "hsl(220 9% 46%)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              dataKey="name"
              type="category"
              width={180}
              tick={{ fontSize: 12, fill: "hsl(220 9% 46%)" }}
              axisLine={false}
              tickLine={false}
            />
            <RechartsTooltip
              content={({ active, payload }: any) => {
                if (!active || !payload?.[0]) return null;
                const d = payload[0];
                return (
                  <div className="bg-card border rounded-xl px-4 py-3 shadow-xl shadow-foreground/5">
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {d.payload.name}
                    </p>
                    <p className="text-sm font-semibold tabular-nums">
                      EBITDA: {fmtDelta(d.value)}/year
                    </p>
                  </div>
                );
              }}
            />
            <ReferenceLine
              x={0}
              stroke="hsl(220 13% 75%)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
            />
            <Bar dataKey="ebitda" name="EBITDA Impact" radius={[0, 6, 6, 0]} barSize={28}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Multi-Metric Impact Table ── */}
      <div className="bg-card border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">
            Multi-Metric Impact Detail
          </h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="max-w-[280px] text-[11px] leading-snug"
            >
              Each row shows the impact of changing ONE variable while
              keeping all others constant. Uses Base scenario as
              reference.
            </TooltipContent>
          </Tooltip>
        </div>
        <p className="text-[11px] text-muted-foreground mb-5 ml-6">
          Impact on EBITDA, Return Multiple, and Payback Period
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2.5 text-xs text-muted-foreground font-medium">
                  Variable
                </th>
                <th className="text-center py-2.5 text-xs text-muted-foreground font-medium">
                  Change
                </th>
                <th className="text-right py-2.5 text-xs text-muted-foreground font-medium">
                  <div className="flex items-center justify-end gap-1.5">
                    <TrendingUp className="h-3 w-3" />
                    EBITDA
                  </div>
                </th>
                <th className="text-right py-2.5 text-xs text-muted-foreground font-medium">
                  <div className="flex items-center justify-end gap-1.5">
                    <Repeat className="h-3 w-3" />
                    Return Multiple
                  </div>
                </th>
                <th className="text-right py-2.5 text-xs text-muted-foreground font-medium">
                  <div className="flex items-center justify-end gap-1.5">
                    <Clock className="h-3 w-3" />
                    Payback
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sensitivity.map((s, i) => (
                <tr key={s.key} className={i === 0 ? "bg-primary/3" : ""}>
                  <td className="py-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor:
                            s.ebitdaImpact >= 0
                              ? "hsl(152 69% 41%)"
                              : "hsl(0 72% 51%)",
                        }}
                      />
                      <span className="text-xs font-semibold">
                        {s.label}
                      </span>
                      {i === 0 && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                          #1 Driver
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 text-center">
                    <span className="text-[11px] text-muted-foreground font-medium bg-muted/60 px-2 py-0.5 rounded-lg">
                      {s.change}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <span
                      className={cn(
                        "text-xs font-bold tabular-nums",
                        s.ebitdaImpact >= 0
                          ? "text-success"
                          : "text-destructive"
                      )}
                    >
                      {fmtDelta(s.ebitdaImpact)}/yr
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    {s.returnMultipleImpact !== null ? (
                      <span
                        className={cn(
                          "text-xs font-semibold tabular-nums",
                          s.returnMultipleImpact >= 0
                            ? "text-success"
                            : "text-destructive"
                        )}
                      >
                        {s.returnMultipleImpact >= 0 ? "+" : ""}
                        {s.returnMultipleImpact.toFixed(2)}x
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    {s.paybackImpact !== null ? (
                      <span
                        className={cn(
                          "text-xs font-semibold tabular-nums",
                          s.paybackImpact <= 0
                            ? "text-success"
                            : "text-destructive"
                        )}
                      >
                        {s.paybackImpact <= 0 ? "" : "+"}
                        {s.paybackImpact.toFixed(1)} yr
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Raw Driver Deltas (granular) ── */}
      <div className="bg-card border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">
            Granular Driver Impact
          </h3>
          <span className="text-[10px] text-muted-foreground ml-auto">
            Individual variable changes
          </span>
        </div>
        <div className="space-y-2.5">
          {Object.values(driverDeltas).map((d: DriverDelta) => {
            const maxEbitda = Math.max(
              ...Object.values(driverDeltas).map((dd: DriverDelta) =>
                Math.abs(dd.ebitdaImpact)
              ),
              1
            );
            const barPct = (Math.abs(d.ebitdaImpact) / maxEbitda) * 100;

            return (
              <div key={d.key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium">{d.label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      ({d.unit})
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span
                      className={cn(
                        "text-[11px] font-medium tabular-nums",
                        d.annualRevenueImpact > 0
                          ? "text-success"
                          : d.annualRevenueImpact < 0
                            ? "text-destructive"
                            : "text-muted-foreground"
                      )}
                    >
                      Rev: {d.annualRevenueImpact >= 0 ? "+" : ""}
                      {fmt(d.annualRevenueImpact)}
                    </span>
                    <span
                      className={cn(
                        "text-[11px] font-bold tabular-nums",
                        d.ebitdaImpact > 0
                          ? "text-success"
                          : d.ebitdaImpact < 0
                            ? "text-destructive"
                            : "text-muted-foreground"
                      )}
                    >
                      EBITDA: {d.ebitdaImpact >= 0 ? "+" : ""}
                      {fmt(d.ebitdaImpact)}
                    </span>
                    {d.paybackImpact !== null && (
                      <span
                        className={cn(
                          "text-[11px] font-medium tabular-nums",
                          d.paybackImpact <= 0
                            ? "text-success"
                            : "text-destructive"
                        )}
                      >
                        {d.paybackImpact <= 0 ? "" : "+"}
                        {d.paybackImpact.toFixed(1)}yr
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      d.ebitdaImpact >= 0 ? "bg-success" : "bg-destructive"
                    )}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
