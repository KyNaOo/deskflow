"use client";

import type { AnalyticsOverview } from "@deskflow/shared";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatLongDay, formatShortDay, ticketCount } from "@/lib/analytics/format";
import { AXIS_TICK, ChartTooltip } from "./chart-tooltip";

type Day = AnalyticsOverview["createdPerDay"][number];

/** Tickets créés par jour : une seule série, donc pas de légende (le titre de la figure la nomme). */
export function CreatedPerDayChart({ data }: { data: Day[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      {/* Lecture au clavier et au lecteur d'écran : par le résumé et le tableau de la figure */}
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
        barCategoryGap={2}
        accessibilityLayer={false}
      >
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="day"
          tickFormatter={formatShortDay}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          minTickGap={24}
        />
        <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={48} />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          content={({ active, payload }) => {
            const day = payload?.[0]?.payload as Day | undefined;
            return (
              <ChartTooltip
                active={active}
                title={day && formatLongDay(day.day)}
                value={day && ticketCount(day.count)}
              />
            );
          }}
        />
        {/* Sans animation : les valeurs s'affichent tout de suite, et rien ne bouge à chaque période */}
        <Bar
          dataKey="count"
          name="Tickets créés"
          fill="var(--chart-1)"
          radius={[4, 4, 0, 0]}
          maxBarSize={24}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
