import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
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
    annualClassRevenue: number;
    annualOtherRevenue: number;
    annualCosts: number;
    breakEvenOccupancy: number;
    weightedOccupancy: number;
  };
}

const formatK = (v: number) => `€${(v / 1000).toFixed(0)}K`;

export function DashboardCharts({ monthlyData, kpis }: DashboardChartsProps) {
  const revenueBreakdown = [
    { name: "Court Rental", value: Math.round(kpis.annualCourtRevenue) },
    { name: "Classes", value: Math.round(kpis.annualClassRevenue) },
    { name: "Other", value: Math.round(kpis.annualOtherRevenue) },
    { name: "Costs", value: Math.round(kpis.annualCosts) },
  ];

  const occupancyData = [
    { name: "Break-even", value: kpis.breakEvenOccupancy },
    { name: "Current", value: kpis.weightedOccupancy },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Revenue vs Costs */}
      <div className="bg-card border rounded-xl p-5">
        <h3 className="font-semibold mb-4">Revenue vs Costs (Annual)</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={revenueBreakdown}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={formatK} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => [`€${v.toLocaleString()}`, ""]} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="hsl(168 76% 36%)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly Evolution */}
      <div className="bg-card border rounded-xl p-5">
        <h3 className="font-semibold mb-4">Monthly Evolution</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={formatK} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => [`€${v.toLocaleString()}`, ""]} />
            <Legend />
            <Line type="monotone" dataKey="revenue" stroke="hsl(168 76% 36%)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="costs" stroke="hsl(0 72% 51%)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="profit" stroke="hsl(222 60% 22%)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Occupancy vs Break-even */}
      <div className="bg-card border rounded-xl p-5 lg:col-span-2">
        <h3 className="font-semibold mb-4">Occupancy vs Break-even</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={occupancyData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
            <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, ""]} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} fill="hsl(222 60% 22%)" barSize={28} />
            <ReferenceLine x={kpis.breakEvenOccupancy} stroke="hsl(0 72% 51%)" strokeDasharray="4 4" strokeWidth={2} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
