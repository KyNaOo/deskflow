"use client";

import type { TicketStatus } from "@deskflow/shared";
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ticketCount } from "@/lib/analytics/format";
import { AXIS_TICK, ChartTooltip } from "./chart-tooltip";

export interface StatusCount {
  status: TicketStatus;
  label: string;
  count: number;
}

/**
 * Répartition par statut : barres horizontales d'une seule couleur. Le statut est écrit sur l'axe,
 * la couleur n'a donc rien à distinguer ; la valeur est inscrite au bout de chaque barre.
 */
export function StatusChart({ data }: { data: StatusCount[] }) {
  return (
    <ResponsiveContainer width="100%" height={data.length * 40 + 16}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 40, bottom: 8, left: 0 }}
        barCategoryGap={8}
        accessibilityLayer={false}
      >
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="label" width={160} tick={AXIS_TICK} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          content={({ active, payload }) => {
            const entry = payload?.[0]?.payload as StatusCount | undefined;
            return <ChartTooltip active={active} title={entry?.label} value={entry && ticketCount(entry.count)} />;
          }}
        />
        {/* Sans animation : Recharts n'affiche les valeurs qu'à la fin de l'animation */}
        <Bar
          dataKey="count"
          name="Tickets"
          fill="var(--chart-1)"
          radius={[0, 4, 4, 0]}
          maxBarSize={24}
          isAnimationActive={false}
        >
          <LabelList dataKey="count" position="right" fill="var(--foreground)" fontSize={12} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
