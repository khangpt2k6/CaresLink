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
    <div className="h-56 w-full min-h-[224px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(14,165,233,0.08)" vertical={false} />
          <XAxis dataKey="channel" tick={{ fontSize: 11, fill: "#0ea5e9" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#0ea5e9" }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} />
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
          <Bar dataKey="rate" fill="#7dd3fc" name="Response Rate" radius={[6, 6, 0, 0]} barSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CommunicationPieChart({ metrics }: { metrics: Metrics }) {
  const data = [
    { name: "Email", value: metrics.emailsSent, color: "#0ea5e9" },
    { name: "SMS", value: metrics.smsSent, color: "#7dd3fc" },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <div className="flex h-44 items-center justify-center text-sm text-sky-600">
        No data yet
      </div>
    );
  }

  return (
    <div className="h-44 w-full min-h-[176px]">
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
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px", color: "#0ea5e9" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
