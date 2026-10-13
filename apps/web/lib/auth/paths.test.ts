import { describe, expect, it } from "vitest";
import { homePath, isPublicPath, loginPathFor } from "./paths";

describe("homePath", () => {
  it("envoie un client sur le portail, un agent ou un admin sur son espace", () => {
    expect(homePath("CUSTOMER", "acme")).toBe("/portal/acme/tickets");
    expect(homePath("AGENT", "acme")).toBe("/acme/tickets");
    expect(homePath("ADMIN", "acme")).toBe("/acme/tickets");
  });
});

describe("isPublicPath", () => {
  it.each(["/login", "/register", "/refresh", "/invitations/abc", "/portal/acme", "/portal/acme/", "/portal/acme/login", "/portal/acme/register"])(
    "%s est publique",
    (path) => {
      expect(isPublicPath(path)).toBe(true);
    },
  );

  it.each(["/", "/acme", "/acme/tickets", "/portal/acme/tickets", "/portal/acme/tickets/3", "/portal", "/login-admin"])(
    "%s exige une session",
    (path) => {
      expect(isPublicPath(path)).toBe(false);
    },
  );
});

describe("loginPathFor", () => {
  it("renvoie vers la connexion du portail pour une page du portail", () => {
    expect(loginPathFor("/portal/acme/tickets/3")).toBe("/portal/acme/login");
    expect(loginPathFor("/portal/acme?x=1")).toBe("/portal/acme/login");
  });

  it("renvoie vers la connexion des agents sinon", () => {
    expect(loginPathFor("/acme/tickets")).toBe("/login");
    expect(loginPathFor("/")).toBe("/login");
  });
});
