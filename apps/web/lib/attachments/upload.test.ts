import { describe, expect, it } from "vitest";
import { fileMimeType } from "./upload";

describe("fileMimeType", () => {
  it("garde le type donné par le navigateur", () => {
    expect(fileMimeType({ name: "capture.png", type: "image/png" })).toBe("image/png");
  });

  it.each(["", "text/x-log", "application/octet-stream"])("reconnaît un journal texte typé « %s »", (type) => {
    expect(fileMimeType({ name: "erreurs.LOG", type })).toBe("text/plain");
  });

  it("laisse un type inconnu tel quel (refusé ensuite par la validation)", () => {
    expect(fileMimeType({ name: "archive.xyz", type: "" })).toBe("");
    expect(fileMimeType({ name: "page.html", type: "text/html" })).toBe("text/html");
  });
});
