import { useState, useMemo, useCallback } from "react";
import { ProjectInputs } from "@/lib/types";
import { KPIResult } from "@/lib/calculations";
import { formatCurrency, getCurrencySymbol } from "@/lib/currency";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertTriangle, Plus, Trash2, Info, BarChart3,
  Users, Calendar, CheckCircle2, Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
} from "recharts";

interface Investor {
  id: string;
  name: string;
  investment: number;
}

interface TimelinePhase {
  id: string;
  phase: string;
  monthRange: string;
  description: string;
  amount: number;
}

interface InvestmentTabProps {
  inputs: ProjectInputs;
  kpis: KPIResult;
  allScenarioKPIs: {
    base: KPIResult;
    optimistic: KPIResult;
    pessimistic: KPIResult;
  } | null;
  onInputChange: (key: keyof ProjectInputs, value: string | number) => void;
  readOnly: boolean;
  currency?: string;
}

const PIE_COLORS = [
  "hsl(225 53% 22%)",
  "hsl(152 57% 24%)",
  "hsl(38 92% 50%)",
  "hsl(353 78% 44%)",
  "hsl(262 83% 58%)",
  "hsl(190 80% 42%)",
];

const pct = (part: number, total: number) =>
  total > 0 ? ((part / total) * 100).toFixed(1) : "0.0";

let _id = 0;
const uid = () => `inv-${++_id}-${Date.now()}`;

const FOUNDERS_PCT = 25;
const INVESTORS_PCT = 75;

export function InvestmentTab({ inputs, kpis, onInputChange, readOnly, currency = "EUR" }: InvestmentTabProps) {
  const fmt = (val: number) => formatCurrency(val, currency);
  const sym = getCurrencySymbol(currency);
  const totalCapex = kpis.totalInvestment;

  const [investors, setInvestors] = useState<Investor[]>(() => [
    { id: uid(), name: "Lead Investor", investment: 0 },
  ]);

  const investorsWithAdjusted = useMemo(() => {
    const othersTotal = investors.slice(1).reduce((s, inv) => s + inv.investment, 0);
    const leadAmount = Math.max(0, totalCapex - othersTotal);
    return investors.map((inv, i) =>
      i === 0 ? { ...inv, investment: leadAmount } : inv
    );
  }, [investors, totalCapex]);

  const totalInvestorContribution = investorsWithAdjusted.reduce((s, inv) => s + inv.investment, 0);
  const contributionMatches = Math.abs(totalInvestorContribution - totalCapex) < 1;

  const [phases, setPhases] = useState<TimelinePhase[]>([
    { id: uid(), phase: "Planning & Permits", monthRange: "1-2", description: "Permits, design, legal", amount: 0 },
    { id: uid(), phase: "Construction", monthRange: "3-6", description: "Court building & facility", amount: 0 },
    { id: uid(), phase: "Equipment & Setup", monthRange: "7-8", description: "Equipment, furnishing, testing", amount: 0 },
  ]);
  const timelineTotal = phases.reduce((s, p) => s + p.amount, 0);
  const timelineMatches = Math.abs(timelineTotal - totalCapex) < 1;
  const timelineHasValues = timelineTotal > 0;

  const capexItems = useMemo(() => {
    const courts = inputs.numberOfCourts;
    const courtTotal = inputs.courtConstructionCost * courts;
    return [
      { label: "Court Construction", value: courtTotal, key: "courtConstructionCost" as const, perUnit: true },
      { label: "Facility Buildout", value: inputs.facilityBuildout, key: "facilityBuildout" as const, perUnit: false },
      { label: "Equipment", value: inputs.equipmentCost, key: "equipmentCost" as const, perUnit: false },
    ];
  }, [inputs.numberOfCourts, inputs.courtConstructionCost, inputs.facilityBuildout, inputs.equipmentCost]);

  const capexPieData = capexItems.filter(c => c.value > 0).map(c => ({
    name: c.label, value: c.value,
  }));

  const updateInvestor = useCallback((id: string, field: "name" | "investment", val: string | number) => {
    setInvestors(prev => prev.map(inv =>
      inv.id === id ? { ...inv, [field]: field === "investment" ? (typeof val === "number" ? val : parseFloat(val) || 0) : val } : inv
    ));
  }, []);

  const addInvestor = useCallback(() => {
    setInvestors(prev => [...prev, { id: uid(), name: `Investor ${prev.length}`, investment: 0 }]);
  }, []);

  const removeInvestor = useCallback((id: string) => {
    setInvestors(prev => {
      if (prev.length <= 1) return prev;
      const idx = prev.findIndex(inv => inv.id === id);
      if (idx === 0) return prev;
      return prev.filter(inv => inv.id !== id);
    });
  }, []);

  const updatePhase = useCallback((id: string, field: keyof TimelinePhase, val: string | number) => {
    setPhases(prev => prev.map(p =>
      p.id === id ? { ...p, [field]: field === "amount" ? (typeof val === "number" ? val : parseFloat(val) || 0) : val } : p
    ));
  }, []);

  const addPhase = useCallback(() => {
    setPhases(prev => [...prev, { id: uid(), phase: "New Phase", monthRange: "", description: "", amount: 0 }]);
  }, []);

  const removePhase = useCallback((id: string) => {
    setPhases(prev => prev.length > 1 ? prev.filter(p => p.id !== id) : prev);
  }, []);

  const autoFillTimeline = useCallback(() => {
    setPhases(prev => {
      const count = prev.length;
      if (count === 0) return prev;
      const base = Math.floor(totalCapex / count);
      const remainder = totalCapex - base * count;
      return prev.map((p, i) => ({
        ...p,
        amount: base + (i === 0 ? remainder : 0),
      }));
    });
  }, [totalCapex]);

  const MatchBadge = ({ matches, label }: { matches: boolean; label?: string }) => (
    <span className={cn(
      "inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full",
      matches
        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        : "bg-warning/10 text-warning"
    )}>
      {matches ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {label ?? (matches ? "Matches CAPEX" : "Mismatch")}
    </span>
  );

  return (
    <div className="space-y-6 animate-fade-in">

      {/* CAPEX BREAKDOWN */}
      <div className="bg-card border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">CAPEX Breakdown</h3>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 text-xs text-muted-foreground font-medium">Concept</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">Amount ({sym})</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {capexItems.map((item) => (
                  <tr key={item.key}>
                    <td className="py-3 text-xs">
                      {item.label}
                      {item.perUnit && (
                        <span className="text-muted-foreground ml-1">
                          ({inputs.numberOfCourts} × {sym}{inputs.courtConstructionCost.toLocaleString()})
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-xs text-right tabular-nums font-semibold">{fmt(item.value)}</td>
                    <td className="py-3 text-xs text-right tabular-nums text-muted-foreground">{pct(item.value, totalCapex)}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2">
                  <td className="py-3 text-xs font-bold">Total CAPEX</td>
                  <td className="py-3 text-xs text-right tabular-nums font-bold">{fmt(totalCapex)}</td>
                  <td className="py-3 text-xs text-right tabular-nums font-bold">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {capexPieData.length > 0 && (
            <div className="flex flex-col items-center justify-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={capexPieData} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                    strokeWidth={2} stroke="hsl(var(--card))"
                  >
                    {capexPieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
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
                {capexPieData.map((d, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-[10px] text-muted-foreground">{d.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* EQUITY STRUCTURE */}
      <div className="bg-card border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Equity Structure</h3>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[260px] text-[11px] leading-snug">
                Founders hold a fixed {FOUNDERS_PCT}% equity with no cash contribution. Investors fund 100% of CAPEX and share the remaining {INVESTORS_PCT}% proportionally.
              </TooltipContent>
            </Tooltip>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs h-8" onClick={addInvestor} disabled={readOnly}>
            <Plus className="h-3.5 w-3.5" /> Add Investor
          </Button>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Total CAPEX to fund:</span>
            <span className="text-sm font-bold tabular-nums">{fmt(totalCapex)}</span>
          </div>
          <MatchBadge matches={contributionMatches} label={contributionMatches ? "Fully funded" : "Investment mismatch"} />
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 text-xs text-muted-foreground font-medium">Name</th>
              <th className="text-right py-2 text-xs text-muted-foreground font-medium">Investment ({sym})</th>
              <th className="text-right py-2 text-xs text-muted-foreground font-medium">Equity (%)</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            <tr className="bg-muted/20">
              <td className="py-2.5 text-xs font-medium text-muted-foreground pl-1">
                Founders
                <span className="ml-2 text-[10px] text-muted-foreground/70 italic">no cash contribution</span>
              </td>
              <td className="py-2.5 text-xs text-right tabular-nums text-muted-foreground">{sym}0</td>
              <td className="py-2.5 text-xs text-right tabular-nums font-semibold">{FOUNDERS_PCT.toFixed(1)}%</td>
              <td></td>
            </tr>

            {investorsWithAdjusted.map((inv, i) => {
              const equityPctVal = totalCapex > 0
                ? (inv.investment / totalCapex) * INVESTORS_PCT
                : 0;
              const isLead = i === 0;
              return (
                <tr key={inv.id}>
                  <td className="py-2">
                    <Input
                      value={inv.name}
                      onChange={(e) => updateInvestor(inv.id, "name", e.target.value)}
                      disabled={readOnly}
                      className="h-8 text-xs border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                    />
                  </td>
                  <td className="py-2">
                    {isLead ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-xs tabular-nums font-semibold">{fmt(inv.investment)}</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-[11px]">
                            Auto-calculated: Total CAPEX minus other investors
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    ) : (
                      <Input
                        type="number" min={0} max={totalCapex} step={1000}
                        value={inv.investment || ""}
                        onChange={(e) => updateInvestor(inv.id, "investment", e.target.value)}
                        disabled={readOnly}
                        className="h-8 text-xs text-right tabular-nums w-32 ml-auto"
                        placeholder="0"
                      />
                    )}
                  </td>
                  <td className="py-2 text-xs text-right tabular-nums text-muted-foreground font-semibold">
                    {equityPctVal.toFixed(1)}%
                  </td>
                  <td className="py-2 text-center">
                    {!isLead && (
                      <button onClick={() => removeInvestor(inv.id)} disabled={readOnly}
                        className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2">
              <td className="py-2.5 text-xs font-bold">Total</td>
              <td className="py-2.5 text-xs text-right tabular-nums font-bold">{fmt(totalInvestorContribution)}</td>
              <td className="py-2.5 text-xs text-right tabular-nums font-bold">100.0%</td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        {!contributionMatches && (
          <div className="flex items-center gap-2 text-warning bg-warning/5 border border-warning/20 rounded-lg px-3 py-2 mt-3">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="text-xs">
              Total investment ({fmt(totalInvestorContribution)}) must match CAPEX ({fmt(totalCapex)}) — difference: {fmt(Math.abs(totalInvestorContribution - totalCapex))}
            </span>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed">
          Investors fund 100% of CAPEX ({fmt(totalCapex)}) and receive {INVESTORS_PCT}% equity.
          Founders retain {FOUNDERS_PCT}% equity without cash contribution.
        </p>
      </div>

      {/* INVESTMENT TIMELINE */}
      <div className="bg-card border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Investment Timeline</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-8" onClick={autoFillTimeline} disabled={readOnly}>
              <Wand2 className="h-3.5 w-3.5" /> Auto-fill from CAPEX
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs h-8" onClick={addPhase} disabled={readOnly}>
              <Plus className="h-3.5 w-3.5" /> Add Phase
            </Button>
          </div>
        </div>

        {timelineHasValues && (
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Timeline total:</span>
              <span className="text-sm font-bold tabular-nums">{fmt(timelineTotal)}</span>
            </div>
            <MatchBadge matches={timelineMatches} />
          </div>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 text-xs text-muted-foreground font-medium">Phase</th>
              <th className="text-left py-2 text-xs text-muted-foreground font-medium">Months</th>
              <th className="text-left py-2 text-xs text-muted-foreground font-medium">Description</th>
              <th className="text-right py-2 text-xs text-muted-foreground font-medium">Amount ({sym})</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {phases.map((phase) => (
              <tr key={phase.id}>
                <td className="py-2">
                  <Input value={phase.phase} onChange={(e) => updatePhase(phase.id, "phase", e.target.value)}
                    disabled={readOnly} className="h-8 text-xs border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" />
                </td>
                <td className="py-2">
                  <Input value={phase.monthRange} onChange={(e) => updatePhase(phase.id, "monthRange", e.target.value)}
                    disabled={readOnly} className="h-8 text-xs border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 w-20" placeholder="e.g. 1-3" />
                </td>
                <td className="py-2">
                  <Input value={phase.description} onChange={(e) => updatePhase(phase.id, "description", e.target.value)}
                    disabled={readOnly} className="h-8 text-xs border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" />
                </td>
                <td className="py-2">
                  <Input type="number" min={0} step={1000} value={phase.amount || ""}
                    onChange={(e) => updatePhase(phase.id, "amount", e.target.value)}
                    disabled={readOnly} className="h-8 text-xs text-right tabular-nums w-28 ml-auto" placeholder="0" />
                </td>
                <td className="py-2 text-center">
                  <button onClick={() => removePhase(phase.id)} disabled={readOnly}
                    className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2">
              <td colSpan={3} className="py-2.5 text-xs font-bold">Total</td>
              <td className="py-2.5 text-xs text-right tabular-nums font-bold">{fmt(timelineTotal)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
