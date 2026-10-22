import { describe, expect, it } from "vitest";
import { parsePeriod, periodRange } from "./period";

describe("parsePeriod", () => {
  it.each([
    [{ period: "7" }, 7],
    [{ period: "90" }, 90],
    [{ period: ["7", "90"] }, 7],
  ])("lit la période de l’URL %j", (searchParams, expected) => {
    expect(parsePeriod(searchParams)).toBe(expected);
  });

  it.each([{}, { period: "" }, { period: "15" }, { period: "abc" }, { period: "-7" }])(
    "vaut 30 jours pour une valeur absente ou invalide %j",
    (searchParams) => {
      expect(parsePeriod(searchParams)).toBe(30);
    },
  );
});

describe("periodRange", () => {
  it("couvre les N derniers jours, aujourd’hui compris", () => {
    expect(periodRange(7, "2026-10-22")).toEqual({ from: "2026-10-16", to: "2026-10-22" });
    expect(periodRange(30, "2026-10-22")).toEqual({ from: "2026-09-23", to: "2026-10-22" });
  });
});
