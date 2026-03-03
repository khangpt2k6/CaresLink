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
          <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e5" vertical={false} />
          <XAxis dataKey="channel" tick={{ fontSize: 12, fill: "#73726e" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: "#73726e" }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(value) => `${Number(value).toFixed(0)}%`}
            contentStyle={{ borderRadius: "6px", background: "#fff", border: "1px solid #e8e8e5", fontSize: "12px" }}
          />
          <Bar dataKey="rate" fill="#2383e2" name="Response Rate" radius={[4, 4, 0, 0]} barSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CommunicationPieChart({ metrics }: { metrics: Metrics }) {
  const data = [
    { name: "Email", value: metrics.emailsSent, color: "#2383e2" },
    { name: "SMS", value: metrics.smsSent, color: "#9b9a97" },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <div className="flex h-44 items-center justify-center text-sm text-[#9b9a97]">
        No data yet
      </div>
    );
  }

  return (
    <div className="h-44 w-full min-h-[176px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={42} outerRadius={62} paddingAngle={4} dataKey="value" strokeWidth={0}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: "6px", background: "#fff", border: "1px solid #e8e8e5", fontSize: "12px" }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px", color: "#73726e" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
