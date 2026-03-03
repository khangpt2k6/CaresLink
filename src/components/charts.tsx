"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface Metrics {
  emailsSent: number;
  smsSent: number;
  responseRateEmail: number;
  responseRateSms: number;
  noShowRate: number;
}

const CHART_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444"];

export function ResponseRateChart({ metrics }: { metrics: Metrics }) {
  const data = [
    { channel: "Email", sent: metrics.emailsSent, rate: metrics.responseRateEmail * 100 },
    { channel: "SMS", sent: metrics.smsSent, rate: metrics.responseRateSms * 100 },
  ];

  return (
    <div className="h-64 min-h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="channel" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
          <Tooltip formatter={(value) => `${Number(value).toFixed(0)}%`} />
          <Bar dataKey="rate" fill="#3b82f6" name="rate" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CommunicationPieChart({ metrics }: { metrics: Metrics }) {
  const data = [
    { name: "Email", value: metrics.emailsSent, color: CHART_COLORS[0] },
    { name: "SMS", value: metrics.smsSent, color: CHART_COLORS[1] },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-slate-500">
        No communication data yet
      </div>
    );
  }

  return (
    <div className="h-48 min-h-[180px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={70}
            paddingAngle={2}
            dataKey="value"
            label={({ name, value }) => `${name}: ${value}`}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
