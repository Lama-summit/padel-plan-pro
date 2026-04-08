import { useMemo } from "react";
import { ProjectInputs, Scenario } from "@/lib/types";
import { calculateSensitivityMatrix } from "@/lib/calculations";
import { formatCurrency, getCurrencySymbol } from "@/lib/currency";
import { cn } from "@/lib/utils";

interface Props {
  inputs: ProjectInputs;
  scenario: Scenario;
  currency: string;
}

function getCellColor(ebitda: number, min: number, max: number): string {
  const range = max - min;
  if (range === 0) return "bg-muted";
  const ratio = (ebitda - min) / range; // 0 = worst, 1 = best
  if (ebitda < 0) {
    // Red shades for negative
    const intensity = Math.min(1, Math.abs(ebitda) / Math.max(Math.abs(min), 1));
    if (intensity > 0.6) return "bg-red-600 text-white";
    if (intensity > 0.3) return "bg-red-400 text-white";
    return "bg-red-200 text-red-900";
  }
  // Green shades for positive
  if (ratio > 0.75) return "bg-emerald-600 text-white";
  if (ratio > 0.5) return "bg-emerald-400 text-white";
  if (ratio > 0.25) return "bg-emerald-200 text-emerald-900";
  return "bg-amber-100 text-amber-900";
}

export function SensitivityMatrix({ inputs, scenario, currency }: Props) {
  const matrix = useMemo(
    () => calculateSensitivityMatrix(inputs, scenario),
    [inputs, scenario]
  );

  const sym = getCurrencySymbol(currency);
  const fmt = (v: number) => formatCurrency(v, currency);

  return (
    <div className="bg-card border rounded-2xl p-6 space-y-4">
      <div>
        <h3 className="text-sm font-semibold">EBITDA Sensitivity Matrix</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Annual EBITDA by occupancy and court price. Base case highlighted.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-left text-muted-foreground font-medium border-b border-r">
                <span className="block text-[10px] uppercase tracking-wider">Occ \ Price</span>
              </th>
              {matrix.priceLevels.map((price) => (
                <th
                  key={price}
                  className="p-2 text-center font-semibold border-b whitespace-nowrap"
                >
                  {sym}{price}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.cells.map((row, ri) => (
              <tr key={matrix.occupancyLevels[ri]}>
                <td className="p-2 font-semibold text-right border-r whitespace-nowrap">
                  {matrix.occupancyLevels[ri]}%
                </td>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={cn(
                      "p-2 text-center font-mono text-[11px] tabular-nums transition-colors",
                      getCellColor(cell.ebitda, matrix.minEbitda, matrix.maxEbitda),
                      cell.isBase && "ring-2 ring-primary ring-inset font-bold"
                    )}
                  >
                    {fmt(cell.ebitda)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-1">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-400" />
          <span>Negative EBITDA</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-amber-100 border border-amber-200" />
          <span>Low</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-emerald-400" />
          <span>High</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded ring-2 ring-primary" />
          <span>Base case</span>
        </div>
      </div>
    </div>
  );
}
