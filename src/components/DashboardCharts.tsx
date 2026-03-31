import { SafeMetric, isSafeValid, CostBreakdown } from "@/lib/calculations";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  Cell,
} from "recharts";

interface MonthlyData {
  month: string;
  revenue: number;
  costs: number;
  profit: number;
}

interface DashboardChartsProps {
  monthlyData: MonthlyData[];
  kpis: {
    annualCourtRevenue: number;
    annualOtherRevenue: number;
    annualCosts: number;
    breakEvenOccupancy: SafeMetric;
    weightedOccupancy: number;
    costBreakdown: CostBreakdown;
  };
}

const formatK = (v: number) => `€${(v / 1000).toFixed(0)}K`;
const chartGridColor = "hsl(220 13% 91%)";

const CustomTooltip = ({ active, payload, label }: any) => {
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
};

export function DashboardCharts({ monthlyData, kpis }: DashboardChartsProps) {
  const revenueBreakdown = [
    { name: "Court Rental", value: Math.round(kpis.annualCourtRevenue), color: "hsl(168 76% 36%)" },
    { name: "Other Revenue", value: Math.round(kpis.annualOtherRevenue), color: "hsl(217 91% 60%)" },
    { name: "Costs", value: Math.round(kpis.annualCosts), color: "hsl(0 72% 51%)" },
  ];

  const beVal = isSafeValid(kpis.breakEvenOccupancy) ? kpis.breakEvenOccupancy.value! : 0;
  const occupancyData = [
    { name: "Break-even", value: beVal, fill: "hsl(220 13% 80%)" },
    { name: "Current", value: kpis.weightedOccupancy, fill: kpis.weightedOccupancy >= beVal ? "hsl(152 69% 41%)" : "hsl(0 72% 51%)" },
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Main chart — Profit highlighted, revenue/costs secondary */}
      <div className="bg-card border rounded-2xl p-6 lg:col-span-2">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-semibold text-base">Monthly Evolution</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Profit trend highlighted · revenue and costs shown for context</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={monthlyData}>
            <defs>
              <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(222 60% 32%)" stopOpacity={0.18} />
                <stop offset="95%" stopColor="hsl(222 60% 32%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(220 9% 46%)" }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={formatK} tick={{ fontSize: 12, fill: "hsl(220 9% 46%)" }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 16, fontSize: 13 }} />
            {/* Revenue & costs — lighter / secondary */}
            <Area type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(168 76% 36%)" strokeWidth={1.5} strokeOpacity={0.45} fill="none" dot={false} />
            <Area type="monotone" dataKey="costs" name="Costs" stroke="hsl(0 72% 51%)" strokeWidth={1.5} strokeOpacity={0.35} fill="none" dot={false} strokeDasharray="6 3" />
            {/* Profit — primary */}
            <Area type="monotone" dataKey="profit" name="Profit" stroke="hsl(222 60% 32%)" strokeWidth={2.5} fill="url(#gradProfit)" dot={false} />
            <ReferenceLine y={0} stroke="hsl(220 13% 80%)" strokeDasharray="4 4" strokeWidth={1.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Revenue Breakdown */}
      <div className="bg-card border rounded-2xl p-6">
        <div className="mb-6">
          <h3 className="font-semibold text-base">Revenue vs Costs</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Annual breakdown by source</p>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={revenueBreakdown} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(220 9% 46%)" }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={formatK} tick={{ fontSize: 11, fill: "hsl(220 9% 46%)" }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" name="Amount" radius={[8, 8, 0, 0]}>
              {revenueBreakdown.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Occupancy vs Break-even */}
      <div className="bg-card border rounded-2xl p-6">
        <div className="mb-6">
          <h3 className="font-semibold text-base">Occupancy vs Break-even</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Current performance against required threshold</p>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={occupancyData} layout="vertical" barCategoryGap="40%">
            <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: "hsl(220 9% 46%)" }} axisLine={false} tickLine={false} />
            <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12, fill: "hsl(220 9% 46%)" }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, ""]} />
            <Bar dataKey="value" name="Occupancy" radius={[0, 8, 8, 0]} barSize={32}>
              {occupancyData.map((entry, index) => (
                <Cell key={index} fill={entry.fill} />
              ))}
            </Bar>
            <ReferenceLine x={beVal} stroke="hsl(0 72% 51%)" strokeDasharray="4 4" strokeWidth={2} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
