"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Metrics {
  emailsSent: number;
  responseRateEmail: number;
  noShowRate: number;
}

export function ResponseRateChart({ metrics }: { metrics: Metrics }) {
  const data = [
    { channel: "Email", rate: Math.round(metrics.responseRateEmail * 100) },
  ];

  return (
    <div className="h-56 w-full min-h-[224px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="channel" tick={{ fontSize: 12, fill: "#5a6b7c" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: "#5a6b7c" }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(value) => `${Number(value).toFixed(0)}%`}
            contentStyle={{ borderRadius: "8px", background: "#fff", border: "1px solid #e2e8f0", fontSize: "12px" }}
          />
          <Bar dataKey="rate" fill="#0090d9" name="Booking Conversion" radius={[4, 4, 0, 0]} barSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CommunicationPieChart({ metrics }: { metrics: Metrics }) {
  if (metrics.emailsSent === 0) {
    return (
      <div className="flex h-44 items-center justify-center text-sm text-[#8a95a3]">
        No data yet
      </div>
    );
  }

  return (
    <div className="flex h-44 items-center justify-center">
      <div className="text-center">
        <div className="text-3xl font-bold text-[#0090d9]">{metrics.emailsSent}</div>
        <div className="text-sm text-[#5a6b7c]">Emails sent</div>
      </div>
    </div>
  );
}
