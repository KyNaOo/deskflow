import { describe, expect, it } from "vitest";
import { hasActiveFilters, parseFilters, toSearchParams, withFilter } from "./filters";

const AGENT_ID = "01a12f11-08cf-775c-83e6-833ccb5d22a2";

describe("parseFilters", () => {
  it("lit les filtres valides de l'URL", () => {
    expect(parseFilters({ status: "OPEN", priority: "HIGH", assignee: "me", q: " panne ", cursor: "abc" })).toEqual({
      status: "OPEN",
      priority: "HIGH",
      assignee: "me",
      q: "panne",
      cursor: "abc",
    });
  });

  it("ignore les valeurs invalides, vides ou inconnues au lieu de casser la page", () => {
    expect(parseFilters({ status: "ARCHIVED", priority: "", assignee: "bob", sort: "asc" })).toEqual({});
  });

  it("garde la première valeur d'un paramètre répété", () => {
    expect(parseFilters({ assignee: [AGENT_ID, "me"] })).toEqual({ assignee: AGENT_ID });
  });
});

describe("toSearchParams", () => {
  it("n'écrit que les filtres renseignés", () => {
    expect(toSearchParams({ status: "PENDING", q: "facture", priority: undefined }).toString()).toBe(
      "status=PENDING&q=facture",
    );
  });

  it("fait l'aller-retour avec parseFilters", () => {
    const filters = { status: "RESOLVED", assignee: AGENT_ID, q: "réseau" } as const;

    expect(parseFilters(Object.fromEntries(toSearchParams(filters)))).toEqual(filters);
  });
});

describe("withFilter", () => {
  it("change un filtre et repart de la première page", () => {
    expect(withFilter({ status: "OPEN", cursor: "abc" }, "priority", "LOW")).toEqual({
      status: "OPEN",
      priority: "LOW",
      cursor: undefined,
    });
  });

  it("retire un filtre remis sur « Tous »", () => {
    expect(withFilter({ status: "OPEN" }, "status", "").status).toBeUndefined();
  });
});

describe("hasActiveFilters", () => {
  it("ne compte pas le curseur comme un filtre", () => {
    expect(hasActiveFilters({ cursor: "abc" })).toBe(false);
    expect(hasActiveFilters({ q: "panne" })).toBe(true);
  });
});
