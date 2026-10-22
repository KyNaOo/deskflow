"use client";

/** Infobulle des graphiques, aux couleurs de l'app (le texte n'est jamais dans la couleur de la série). */
export function ChartTooltip({ active, title, value }: { active?: boolean; title?: string; value?: string }) {
  if (!active || !title) {
    return null;
  }
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground">{value}</p>
    </div>
  );
}

/** Repères discrets : la grille et les axes s'effacent derrière les données. */
export const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 12 };
