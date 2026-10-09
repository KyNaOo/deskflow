import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, refreshSession } from "./client";
import { ApiError } from "./errors";

const fetchMock = vi.fn<typeof fetch>();
const assignMock = vi.fn();

function reply(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), { status });
}

function callsTo(path: string) {
  return fetchMock.mock.calls.filter(([url]) => url === `http://api.test${path}`).length;
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", { location: { assign: assignMock } });
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  assignMock.mockReset();
});

describe("refreshSession", () => {
  it("partage un seul appel /auth/refresh entre des demandes simultanées", async () => {
    fetchMock.mockResolvedValue(reply(204));

    const results = await Promise.all([refreshSession(), refreshSession(), refreshSession()]);

    expect(results).toEqual([true, true, true]);
    expect(callsTo("/auth/refresh")).toBe(1);
  });

  it("refait un appel une fois le précédent terminé", async () => {
    fetchMock.mockResolvedValue(reply(204));

    await refreshSession();
    await refreshSession();

    expect(callsTo("/auth/refresh")).toBe(2);
  });

  it("renvoie false si l'API refuse ou ne répond pas", async () => {
    fetchMock.mockResolvedValueOnce(reply(401)).mockRejectedValueOnce(new TypeError("offline"));

    expect(await refreshSession()).toBe(false);
    expect(await refreshSession()).toBe(false);
  });
});

describe("apiFetch", () => {
  it("renouvelle la session sur un 401 puis rejoue la requête une fois", async () => {
    fetchMock
      .mockResolvedValueOnce(reply(401))
      .mockResolvedValueOnce(reply(204)) // /auth/refresh
      .mockResolvedValueOnce(reply(200, [{ id: "u1" }]));

    await expect(apiFetch("/users")).resolves.toEqual([{ id: "u1" }]);
    expect(callsTo("/users")).toBe(2);
    expect(callsTo("/auth/refresh")).toBe(1);
  });

  it("un seul refresh pour plusieurs requêtes qui reçoivent un 401 en même temps", async () => {
    // Avant le refresh toutes les requêtes reçoivent un 401, après elles réussissent
    let refreshed = false;
    fetchMock.mockImplementation(async (url) => {
      if (url === "http://api.test/auth/refresh") {
        refreshed = true;
        return reply(204);
      }
      return refreshed ? reply(200, {}) : reply(401);
    });

    await Promise.all([apiFetch("/a"), apiFetch("/b"), apiFetch("/c")]);

    expect(callsTo("/auth/refresh")).toBe(1);
  });

  it("renvoie vers /login si la session ne peut pas être renouvelée", async () => {
    fetchMock.mockResolvedValueOnce(reply(401)).mockResolvedValueOnce(reply(401));

    await expect(apiFetch("/users")).rejects.toBeInstanceOf(ApiError);
    expect(assignMock).toHaveBeenCalledWith("/login");
  });

  it("ne tente pas de refresh sur les routes /auth (mauvais identifiants)", async () => {
    fetchMock.mockResolvedValueOnce(reply(401, { message: "Identifiants invalides" }));

    await expect(apiFetch("/auth/login", { method: "POST", json: {} })).rejects.toThrow(
      "Identifiants invalides",
    );
    expect(callsTo("/auth/refresh")).toBe(0);
  });

  it("réunit les messages de validation de l'API", async () => {
    fetchMock.mockResolvedValueOnce(reply(400, { message: ["email invalide", "slug réservé"] }));

    await expect(apiFetch("/auth/register-tenant", { method: "POST", json: {} })).rejects.toThrow(
      "email invalide, slug réservé",
    );
  });
});
