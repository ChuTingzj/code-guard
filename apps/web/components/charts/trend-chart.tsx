'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';

export function TrendChart({
  data,
}: {
  data: Array<{ period: string; passed: number; warning: number; rejected: number }>;
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d5dee3" />
          <XAxis dataKey="period" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Line type="monotone" dataKey="passed" stroke="#15803D" strokeWidth={2} />
          <Line type="monotone" dataKey="warning" stroke="#B45309" strokeWidth={2} />
          <Line type="monotone" dataKey="rejected" stroke="#B91C1C" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ViolationBar({
  data,
}: {
  data: Array<{ ruleTitle: string; count: number }>;
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d5dee3" />
          <XAxis type="number" allowDecimals={false} />
          <YAxis type="category" dataKey="ruleTitle" width={140} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="count" fill="#0F766E" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
