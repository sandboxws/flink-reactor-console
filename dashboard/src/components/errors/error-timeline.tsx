"use client";

import { useMemo } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

// ---------------------------------------------------------------------------
// Error timeline — occurrence count over time buckets
// ---------------------------------------------------------------------------

const BUCKET_COUNT = 30;

interface Bucket {
  time: number;
  label: string;
  count: number;
}

function bucketize(occurrences: Date[]): Bucket[] {
  if (occurrences.length === 0) return [];

  const min = occurrences[0].getTime();
  const max = occurrences[occurrences.length - 1].getTime();
  const range = Math.max(max - min, 60_000); // at least 1 minute
  const bucketSize = range / BUCKET_COUNT;

  const buckets: Bucket[] = Array.from({ length: BUCKET_COUNT }, (_, i) => {
    const t = min + i * bucketSize;
    const d = new Date(t);
    return {
      time: t,
      label: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      count: 0,
    };
  });

  for (const d of occurrences) {
    const idx = Math.min(
      Math.floor((d.getTime() - min) / bucketSize),
      BUCKET_COUNT - 1,
    );
    if (idx >= 0) {
      buckets[idx].count++;
    }
  }

  return buckets;
}

export function ErrorTimeline({ occurrences }: { occurrences: Date[] }) {
  const data = useMemo(() => bucketize(occurrences), [occurrences]);

  if (data.length === 0) return null;

  return (
    <div className="h-24 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
          barCategoryGap={2}
        >
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: "#565f89" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <Tooltip
            contentStyle={{
              background: "#16161e",
              border: "1px solid #1e1e2e",
              borderRadius: 6,
              fontSize: 11,
              padding: "4px 8px",
            }}
            itemStyle={{ padding: 0, fontSize: 10, color: "#f7768e" }}
            labelStyle={{ color: "#a1a1aa", fontSize: 10 }}
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
          />
          <Bar
            dataKey="count"
            fill="#f7768e"
            radius={[2, 2, 0, 0]}
            name="Occurrences"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
