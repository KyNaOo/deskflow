import { describe, expect, it } from "vitest";
import { formatDuration, formatLongDay, formatShortDay, ticketCount } from "./format";

const MINUTE = 60;
const HOUR = 3600;
const DAY = 24 * HOUR;

describe("formatDuration", () => {
  it.each([
    [0, "moins d’une minute"],
    [59, "moins d’une minute"],
    [60, "1 min"],
    [45 * MINUTE, "45 min"],
    [HOUR, "1 h"],
    [2 * HOUR + 15 * MINUTE, "2 h 15 min"],
    // Arrondi à la minute : 59 min 40 s font une heure, pas « 0 h 60 min »
    [HOUR - 20, "1 h"],
    [23 * HOUR + 59 * MINUTE + 50, "1 j"],
    [DAY, "1 j"],
    [3 * DAY + 4 * HOUR, "3 j 4 h"],
    [10 * DAY + 20 * MINUTE, "10 j"],
  ])("%i s → %s", (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });
});

describe("ticketCount", () => {
  it("accorde au pluriel à partir de 2", () => {
    expect([0, 1, 2].map(ticketCount)).toEqual(["0 ticket", "1 ticket", "2 tickets"]);
  });
});

describe("jours du graphique", () => {
  it("formate un jour calendaire sans décalage de fuseau", () => {
    expect(formatShortDay("2026-10-01")).toBe("1 oct.");
    expect(formatLongDay("2026-10-22")).toBe("jeudi 22 octobre");
  });
});
