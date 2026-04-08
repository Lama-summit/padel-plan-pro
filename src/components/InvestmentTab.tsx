import { useState, useMemo, useCallback } from "react";
import { ProjectInputs } from "@/lib/types";
import { KPIResult, isSafeValid, formatSafeYears } from "@/lib/calculations";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertTriangle, Plus, Trash2, Info, BarChart3, Clock, Target,
  DollarSign, Users, Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────
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
}

// ─── Helpers ─────────────────────────────────────────────────
const PIE_COLORS = [
  "hsl(217 91% 60%)",   // primary blue
  "hsl(152 69% 41%)",   // success green
  "hsl(38 92% 50%)",    // warning amber
  "hsl(346 77% 50%)",   // destructive red
  "hsl(262 83% 58%)",   // purple
  "hsl(190 80% 42%)",   // teal
];

const fmt = (val: number) => {
  if (val >= 1_000_000) return `€${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `€${(val / 1_000).toFixed(0)}K`;
  return `€${val.toFixed(0)}`;
};

const pct = (part: number, total: number) =>
  total > 0 ? ((part / total) * 100).toFixed(1) : "0.0";

let _id = 0;
const uid = () => `inv-${++_id}-${Date.now()}`;

// ─── Component ───────────────────────────────────────────────
export function InvestmentTab({ inputs, kpis, allScenarioKPIs, onInputChange, readOnly }: InvestmentTabProps) {
  // ── Investors state ──
  const [investors, setInvestors] = useState<Investor[]>([
    { id: uid(), name: "Founders", investment: 0 },
    { id: uid(), name: "Investor 1", investment: 0 },
  ]);

  // ── Timeline state ──
  const [phases, setPhases] = useState<TimelinePhase[]>([
    { id: uid(), phase: "Planning & Permits", monthRange: "1-2", description: "Permits, design, legal", amount: 0 },
    { id: uid(), phase: "Construction", monthRange: "3-6", description: "Court building & facility", amount: 0 },
    { id: uid(), phase: "Equipment & Setup", monthRange: "7-8", description: "Equipment, furnishing, testing", amount: 0 },
  ]);

  // ── Derived values ──
  const capexItems = useMemo(() => {
    const courts = inputs.numberOfCourts;
    const courtTotal = inputs.courtConstructionCost * courts;
    return [
      { label: "Court Construction", value: courtTotal, key: "courtConstructionCost" as const, perUnit: true },
      { label: "Facility Buildout", value: inputs.facilityBuildout, key: "facilityBuildout" as const, perUnit: false },
      { label: "Equipment", value: inputs.equipmentCost, key: "equipmentCost" as const, perUnit: false },
    ];
  }, [inputs.numberOfCourts, inputs.courtConstructionCost, inputs.facilityBuildout, inputs.equipmentCost]);

  const totalCapex = kpis.totalInvestment;
  const debtAmount = kpis.loanAmount;
  const equityTotal = kpis.equityInvested;
  const annualDebtPayment = kpis.annualDebtPayment;
  const totalInterest = kpis.totalInterestPaid;

  // Investor equity split: founders get 25%, investors get 75%
  const foundersPct = 25;
  const investorsPct = 75;
  const totalInvestorContribution = investors.reduce((s, inv) => s + inv.investment, 0);
  const investorMismatch = Math.abs(totalInvestorContribution - equityTotal) > 1 && totalInvestorContribution > 0;

  // Timeline
  const timelineTotal = phases.reduce((s, p) => s + p.amount, 0);
  const timelineMismatch = Math.abs(timelineTotal - totalCapex) > 1 && timelineTotal > 0;

  // Pie data for CAPEX
  const capexPieData = capexItems.filter(c => c.value > 0).map(c => ({
    name: c.label, value: c.value,
  }));

  // ── Handlers ──
  const updateInvestor = useCallback((id: string, field: "name" | "investment", val: string | number) => {
    setInvestors(prev => prev.map(inv =>
      inv.id === id ? { ...inv, [field]: field === "investment" ? (typeof val === "number" ? val : parseFloat(val) || 0) : val } : inv
    ));
  }, []);

  const addInvestor = useCallback(() => {
    setInvestors(prev => [...prev, { id: uid(), name: `Investor ${prev.length}`, investment: 0 }]);
  }, []);

  const removeInvestor = useCallback((id: string) => {
    setInvestors(prev => prev.length > 1 ? prev.filter(inv => inv.id !== id) : prev);
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

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ═══ SECTION 1: CAPEX BREAKDOWN ═══ */}
      <div className="bg-card border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">CAPEX Breakdown</h3>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          {/* Table */}
          <div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 text-xs text-muted-foreground font-medium">Concept</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">Amount (€)</th>
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
                          ({inputs.numberOfCourts} × €{inputs.courtConstructionCost.toLocaleString()})
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

          {/* Pie chart */}
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
                          <p className="tabular-nums">€{d.value?.toLocaleString()}</p>
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

      {/* ═══ SECTION 2: FINANCING ═══ */}
      <div className="bg-card border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <DollarSign className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Financing</h3>
        </div>

        {/* Editable financing inputs */}
        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          <div className="space-y-1.5">
            <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Debt Percentage (%)</label>
            <Input
              type="number" min={0} max={100} step={5}
              value={inputs.debtPercentage}
              onChange={(e) => onInputChange("debtPercentage", parseFloat(e.target.value) || 0)}
              disabled={readOnly}
              className="h-9 text-sm tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Interest Rate (%)</label>
            <Input
              type="number" min={0} max={30} step={0.25}
              value={inputs.interestRate}
              onChange={(e) => onInputChange("interestRate", parseFloat(e.target.value) || 0)}
              disabled={readOnly}
              className="h-9 text-sm tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Loan Term (years)</label>
            <Input
              type="number" min={1} max={30} step={1}
              value={inputs.loanTermYears}
              onChange={(e) => onInputChange("loanTermYears", parseFloat(e.target.value) || 1)}
              disabled={readOnly}
              className="h-9 text-sm tabular-nums"
            />
          </div>
        </div>

        {/* Computed financing summary */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-muted/30 rounded-xl p-4">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Debt</p>
            <p className="text-lg font-bold tabular-nums">{fmt(debtAmount)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{inputs.debtPercentage}% of CAPEX</p>
          </div>
          <div className="bg-muted/30 rounded-xl p-4">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Equity</p>
            <p className="text-lg font-bold tabular-nums">{fmt(equityTotal)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{(100 - inputs.debtPercentage).toFixed(0)}% of CAPEX</p>
          </div>
          <div className="bg-muted/30 rounded-xl p-4">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Annual Payment</p>
            <p className="text-lg font-bold tabular-nums">{fmt(annualDebtPayment)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{fmt(kpis.loanPaymentMonth)}/mo</p>
          </div>
          <div className="bg-muted/30 rounded-xl p-4">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Total Interest</p>
            <p className={cn("text-lg font-bold tabular-nums", totalInterest > debtAmount * 0.5 ? "text-warning" : "text-foreground")}>
              {fmt(totalInterest)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Over {inputs.loanTermYears} years</p>
          </div>
        </div>

        {/* Debt + Equity = CAPEX validation */}
        <div className="flex items-center gap-2 mt-3 text-[10px] text-muted-foreground">
          <Info className="h-3 w-3" />
          <span>Debt ({fmt(debtAmount)}) + Equity ({fmt(equityTotal)}) = {fmt(debtAmount + equityTotal)}</span>
          {Math.abs(debtAmount + equityTotal - totalCapex) < 1 ? (
            <span className="text-success font-medium ml-1">✓ Matches CAPEX</span>
          ) : (
            <span className="text-destructive font-medium ml-1">✗ Mismatch</span>
          )}
        </div>
      </div>

      {/* ═══ SECTION 3: EQUITY STRUCTURE ═══ */}
      <div className="bg-card border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Equity Structure</h3>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px] text-[11px] leading-snug">
                Founders hold {foundersPct}% equity. Remaining {investorsPct}% is distributed among investors proportionally to their contribution.
              </TooltipContent>
            </Tooltip>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs h-8" onClick={addInvestor} disabled={readOnly}>
            <Plus className="h-3.5 w-3.5" /> Add Investor
          </Button>
        </div>

        <div className="mb-3 flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Equity to distribute:</span>
          <span className="text-sm font-bold tabular-nums">{fmt(equityTotal)}</span>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 text-xs text-muted-foreground font-medium">Investor</th>
              <th className="text-right py-2 text-xs text-muted-foreground font-medium">Investment (€)</th>
              <th className="text-right py-2 text-xs text-muted-foreground font-medium">Equity (%)</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {investors.map((inv, i) => {
              const isFounder = i === 0;
              const equityPctVal = isFounder
                ? foundersPct
                : totalInvestorContribution > 0
                  ? (inv.investment / totalInvestorContribution) * investorsPct
                  : 0;
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
                    <Input
                      type="number" min={0} step={1000}
                      value={inv.investment || ""}
                      onChange={(e) => updateInvestor(inv.id, "investment", e.target.value)}
                      disabled={readOnly}
                      className="h-8 text-xs text-right tabular-nums w-32 ml-auto"
                      placeholder="0"
                    />
                  </td>
                  <td className="py-2 text-xs text-right tabular-nums text-muted-foreground">
                    {equityPctVal.toFixed(1)}%
                  </td>
                  <td className="py-2 text-center">
                    {investors.length > 1 && (
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
              <td className="py-2 text-xs font-bold">Total</td>
              <td className="py-2 text-xs text-right tabular-nums font-bold">{fmt(totalInvestorContribution)}</td>
              <td className="py-2 text-xs text-right tabular-nums font-bold">100%</td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        {investorMismatch && (
          <div className="flex items-center gap-2 text-warning bg-warning/5 border border-warning/20 rounded-lg px-3 py-2 mt-3">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="text-xs">
              Investor contributions ({fmt(totalInvestorContribution)}) don't match required equity ({fmt(equityTotal)}) — difference: {fmt(Math.abs(totalInvestorContribution - equityTotal))}
            </span>
          </div>
        )}
      </div>

      {/* ═══ SECTION 4: INVESTMENT TIMELINE ═══ */}
      <div className="bg-card border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Investment Timeline</h3>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs h-8" onClick={addPhase} disabled={readOnly}>
            <Plus className="h-3.5 w-3.5" /> Add Phase
          </Button>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 text-xs text-muted-foreground font-medium">Phase</th>
              <th className="text-left py-2 text-xs text-muted-foreground font-medium">Months</th>
              <th className="text-left py-2 text-xs text-muted-foreground font-medium">Description</th>
              <th className="text-right py-2 text-xs text-muted-foreground font-medium">Amount (€)</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {phases.map((p) => (
              <tr key={p.id}>
                <td className="py-2">
                  <Input value={p.phase} onChange={(e) => updatePhase(p.id, "phase", e.target.value)}
                    disabled={readOnly} className="h-8 text-xs border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" />
                </td>
                <td className="py-2">
                  <Input value={p.monthRange} onChange={(e) => updatePhase(p.id, "monthRange", e.target.value)}
                    disabled={readOnly} className="h-8 text-xs w-20 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                    placeholder="e.g. 1-3" />
                </td>
                <td className="py-2">
                  <Input value={p.description} onChange={(e) => updatePhase(p.id, "description", e.target.value)}
                    disabled={readOnly} className="h-8 text-xs border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                    placeholder="Description" />
                </td>
                <td className="py-2">
                  <Input type="number" min={0} step={1000} value={p.amount || ""}
                    onChange={(e) => updatePhase(p.id, "amount", e.target.value)}
                    disabled={readOnly} className="h-8 text-xs text-right tabular-nums w-28 ml-auto" placeholder="0" />
                </td>
                <td className="py-2 text-center">
                  {phases.length > 1 && (
                    <button onClick={() => removePhase(p.id)} disabled={readOnly}
                      className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2">
              <td colSpan={3} className="py-2 text-xs font-bold">Total</td>
              <td className="py-2 text-xs text-right tabular-nums font-bold">{fmt(timelineTotal)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        {timelineMismatch && (
          <div className="flex items-center gap-2 text-warning bg-warning/5 border border-warning/20 rounded-lg px-3 py-2 mt-3">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="text-xs">
              Timeline total ({fmt(timelineTotal)}) doesn't match CAPEX ({fmt(totalCapex)}) — difference: {fmt(Math.abs(timelineTotal - totalCapex))}
            </span>
          </div>
        )}
      </div>

      {/* ═══ SECTION 5: SCENARIO COMPARISON ═══ */}
      {allScenarioKPIs && (
        <div className="bg-card border rounded-2xl p-6">
          <h3 className="text-sm font-semibold mb-4">Investment Returns by Scenario</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 text-xs text-muted-foreground font-medium">Metric</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">Pessimistic</th>
                  <th className="text-right py-2 text-xs font-semibold">Base</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">Optimistic</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="py-2 text-xs text-muted-foreground">Annual EBITDA</td>
                  <td className="py-2 text-xs text-right tabular-nums">{fmt(allScenarioKPIs.pessimistic.ebitdaYear)}</td>
                  <td className="py-2 text-xs text-right tabular-nums font-semibold">{fmt(allScenarioKPIs.base.ebitdaYear)}</td>
                  <td className="py-2 text-xs text-right tabular-nums">{fmt(allScenarioKPIs.optimistic.ebitdaYear)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-xs text-muted-foreground">Cash Flow to Equity</td>
                  <td className="py-2 text-xs text-right tabular-nums">{fmt(allScenarioKPIs.pessimistic.cashFlowToEquity)}</td>
                  <td className="py-2 text-xs text-right tabular-nums font-semibold">{fmt(allScenarioKPIs.base.cashFlowToEquity)}</td>
                  <td className="py-2 text-xs text-right tabular-nums">{fmt(allScenarioKPIs.optimistic.cashFlowToEquity)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-xs text-muted-foreground">Payback</td>
                  <td className="py-2 text-xs text-right tabular-nums">{formatSafeYears(allScenarioKPIs.pessimistic.paybackYears)}</td>
                  <td className="py-2 text-xs text-right tabular-nums font-semibold">{formatSafeYears(allScenarioKPIs.base.paybackYears)}</td>
                  <td className="py-2 text-xs text-right tabular-nums">{formatSafeYears(allScenarioKPIs.optimistic.paybackYears)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-xs text-muted-foreground">ROI on Equity</td>
                  <td className="py-2 text-xs text-right tabular-nums">{isSafeValid(allScenarioKPIs.pessimistic.roiOnEquity) ? `${allScenarioKPIs.pessimistic.roiOnEquity.value!.toFixed(1)}%` : "—"}</td>
                  <td className="py-2 text-xs text-right tabular-nums font-semibold">{isSafeValid(allScenarioKPIs.base.roiOnEquity) ? `${allScenarioKPIs.base.roiOnEquity.value!.toFixed(1)}%` : "—"}</td>
                  <td className="py-2 text-xs text-right tabular-nums">{isSafeValid(allScenarioKPIs.optimistic.roiOnEquity) ? `${allScenarioKPIs.optimistic.roiOnEquity.value!.toFixed(1)}%` : "—"}</td>
                </tr>
                <tr>
                  <td className="py-2 text-xs text-muted-foreground">Net Cashflow/yr</td>
                  <td className="py-2 text-xs text-right tabular-nums">{fmt(allScenarioKPIs.pessimistic.netCashflowYear)}</td>
                  <td className="py-2 text-xs text-right tabular-nums font-semibold">{fmt(allScenarioKPIs.base.netCashflowYear)}</td>
                  <td className="py-2 text-xs text-right tabular-nums">{fmt(allScenarioKPIs.optimistic.netCashflowYear)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
