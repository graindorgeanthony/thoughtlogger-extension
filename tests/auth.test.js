import { describe, expect, it, vi } from "vitest";
import { connect, createPkce, getAccessToken, validateOAuthCallback } from "../lib/auth.js";

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return { data, async get(key) { return typeof key === "string" ? { [key]: data[key] } : data; }, async set(values) { Object.assign(data, values); }, async remove(keys) { for (const key of [].concat(keys)) delete data[key]; } };
}

describe("OAuth security", () => {
  it("creates RFC 7636 verifier, challenge, and CSRF state", async () => {
    const pkce = await createPkce();
    expect(pkce.verifier.length).toBeGreaterThan(43); expect(pkce.challenge).toMatch(/^[\w-]+$/); expect(pkce.state).not.toBe(pkce.verifier);
  });
  it("requires the exact redirect and matching state", () => {
    const redirect = "https://abcdefghijklmnop.chromiumapp.org/oauth2";
    expect(validateOAuthCallback(`${redirect}?code=ok&state=safe`, redirect, "safe")).toBe("ok");
    expect(() => validateOAuthCallback(`${redirect}?code=ok&state=evil`, redirect, "safe")).toThrow(/state/);
    expect(() => validateOAuthCallback("https://evil.test/oauth2?code=ok&state=safe", redirect, "safe")).toThrow(/redirect/);
  });
  it("rotates refresh tokens and stores the new access token", async () => {
    const storage = memoryStorage({ "auth.tokens": { accessToken: "old", refreshToken: "refresh-old", expiresAt: 0 } });
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ access_token: "new", refresh_token: "refresh-new", expires_in: 3600 }) }));
    await expect(getAccessToken({ storage, fetchImpl, clientId: "public-test-client" })).resolves.toBe("new");
    expect(storage.data["auth.tokens"]).toMatchObject({ accessToken: "new", refreshToken: "refresh-new" });
  });
  it("uses a bounded hidden web flow for an existing website session", async () => {
    const storage = memoryStorage();
    const redirect = "https://hddpolnkggknnndcgokinclghiopbdom.chromiumapp.org/oauth2";
    const identity = {
      getRedirectURL: vi.fn(() => redirect),
      launchWebAuthFlow: vi.fn(async (details) => {
        const state = new URL(details.url).searchParams.get("state");
        return `${redirect}?code=authorization-code&state=${state}`;
      }),
    };
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ access_token: "access", refresh_token: "refresh", expires_in: 3600 }),
    }));

    await expect(connect({ storage, identity, fetchImpl, interactive: false })).resolves.toMatchObject({ accessToken: "access" });
    expect(identity.launchWebAuthFlow).toHaveBeenCalledWith(expect.objectContaining({
      interactive: false,
      abortOnLoadForNonInteractive: false,
      timeoutMsForNonInteractive: 8000,
    }));
    expect(storage.data["auth.pkce"]).toBeUndefined();
  });
  it("cleans up PKCE state when a silent session check cannot finish", async () => {
    const storage = memoryStorage();
    const identity = {
      getRedirectURL: () => "https://hddpolnkggknnndcgokinclghiopbdom.chromiumapp.org/oauth2",
      launchWebAuthFlow: vi.fn(async () => { throw new Error("interaction required"); }),
    };

    await expect(connect({ storage, identity, fetchImpl: vi.fn(), interactive: false })).rejects.toThrow(/interaction required/);
    expect(storage.data["auth.pkce"]).toBeUndefined();
    expect(storage.data["auth.tokens"]).toBeUndefined();
  });
});
