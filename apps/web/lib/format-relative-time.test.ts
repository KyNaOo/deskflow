import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./format-relative-time";

const now = new Date("2026-10-12T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

describe("formatRelativeTime", () => {
  it.each([
    [10_000, "à l’instant"],
    [5 * 60_000, "il y a 5 minutes"],
    [3 * 3_600_000, "il y a 3 heures"],
    [26 * 3_600_000, "hier"],
    [4 * 86_400_000, "il y a 4 jours"],
  ])("%i ms → %s", (elapsed, expected) => {
    expect(formatRelativeTime(ago(elapsed), now)).toBe(expected);
  });

  it("affiche la date au-delà d'un mois", () => {
    expect(formatRelativeTime(new Date("2026-08-01T10:00:00Z"), now)).toBe("1 août 2026");
  });
});
