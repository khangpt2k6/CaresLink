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
  Legend,
} from "recharts";

interface Metrics {
  emailsSent: number;
  smsSent: number;
  responseRateEmail: number;
  responseRateSms: number;
  noShowRate: number;
}

export function ResponseRateChart({ metrics }: { metrics: Metrics }) {
  const data = [
    { channel: "Email", rate: metrics.responseRateEmail * 100 },
    { channel: "SMS", rate: metrics.responseRateSms * 100 },
  ];

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(13,148,136,0.08)" vertical={false} />
          <XAxis dataKey="channel" tick={{ fontSize: 11, fill: "#0d9488" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#0d9488" }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(value) => `${Number(value).toFixed(0)}%`}
            contentStyle={{
              borderRadius: "8px",
              background: "rgba(255,255,255,0.8)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.6)",
              fontSize: "12px",
            }}
          />
          <Bar dataKey="rate" fill="#5eead4" name="Response Rate" radius={[6, 6, 0, 0]} barSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CommunicationPieChart({ metrics }: { metrics: Metrics }) {
  const data = [
    { name: "Email", value: metrics.emailsSent, color: "#0d9488" },
    { name: "SMS", value: metrics.smsSent, color: "#5eead4" },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <div className="flex h-44 items-center justify-center text-sm text-teal-600">
        No data yet
      </div>
    );
  }

  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={42}
            outerRadius={62}
            paddingAngle={4}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              background: "rgba(255,255,255,0.8)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.6)",
              fontSize: "12px",
            }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px", color: "#0d9488" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
