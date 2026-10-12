import { describe, expect, it } from "vitest";
import { statusOptions } from "./status-options";

describe("statusOptions", () => {
  it("propose le statut actuel puis les transitions autorisées", () => {
    expect(statusOptions("OPEN")).toEqual(["OPEN", "PENDING", "RESOLVED", "CLOSED"]);
    expect(statusOptions("RESOLVED")).toEqual(["RESOLVED", "OPEN", "CLOSED"]);
  });

  it("ne propose rien d'autre pour un ticket clos", () => {
    expect(statusOptions("CLOSED")).toEqual(["CLOSED"]);
  });
});
