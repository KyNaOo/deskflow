import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next-path";

describe("safeNextPath", () => {
  it("garde un chemin interne", () => {
    expect(safeNextPath("/acme?status=OPEN")).toBe("/acme?status=OPEN");
  });

  it.each(["//evil.com", "/\\evil.com", "https://evil.com", "evil.com", undefined, ["/a", "/b"]])(
    "renvoie vers l'accueil pour %s",
    (next) => {
      expect(safeNextPath(next)).toBe("/");
    },
  );
});
