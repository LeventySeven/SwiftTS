"use client";
import * as React from "react";
import { Chart, BarMark, LineMark, v } from "@sui";
import { GallerySection, Card } from "./chrome";

const SALES = [
  { month: "Jan", revenue: 320 },
  { month: "Feb", revenue: 410 },
  { month: "Mar", revenue: 390 },
  { month: "Apr", revenue: 520 },
  { month: "May", revenue: 480 },
  { month: "Jun", revenue: 610 },
];

const SERIES = [
  { day: 1, a: 12, b: 7 },
  { day: 2, a: 18, b: 10 },
  { day: 3, a: 15, b: 14 },
  { day: 4, a: 22, b: 12 },
  { day: 5, a: 28, b: 18 },
  { day: 6, a: 25, b: 21 },
  { day: 7, a: 33, b: 24 },
];

export function SectionCharts(): React.ReactElement {
  return (
    <GallerySection
      id="charts"
      title="Charts"
      subtitle="Swift Charts grammar — BarMark and LineMark with axes"
    >
      <Card title="BarMark — monthly revenue">
        <div style={{ height: 240 }}>
          <Chart
            data={SALES}
            xAxisLabel="Month"
            yAxisLabel="Revenue ($K)"
            style={{ height: "100%" }}
          >
            {(row) => {
              const r = row as (typeof SALES)[number];
              return (
                <BarMark
                  x={v("Month", r.month)}
                  y={v("Revenue", r.revenue)}
                  foregroundStyle="var(--sui-color-system-blue)"
                  cornerRadius={5}
                />
              );
            }}
          </Chart>
        </div>
      </Card>

      <Card title="LineMark — two series">
        <div style={{ height: 240 }}>
          <Chart data={SERIES} xAxisLabel="Day" yAxisLabel="Active users (K)" style={{ height: "100%" }}>
            {(row) => {
              const r = row as (typeof SERIES)[number];
              return (
                <>
                  <LineMark
                    x={v("Day", r.day)}
                    y={v("Users", r.a)}
                    series={v("Cohort", "iOS")}
                    foregroundStyleBy={v("Cohort", "iOS")}
                    interpolationMethod="monotone"
                  />
                  <LineMark
                    x={v("Day", r.day)}
                    y={v("Users", r.b)}
                    series={v("Cohort", "Web")}
                    foregroundStyleBy={v("Cohort", "Web")}
                    interpolationMethod="monotone"
                  />
                </>
              );
            }}
          </Chart>
        </div>
      </Card>
    </GallerySection>
  );
}
