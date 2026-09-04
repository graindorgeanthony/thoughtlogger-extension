import { describe, expect, it, vi } from "vitest";
import { createPkce, getAccessToken, validateOAuthCallback } from "../lib/auth.js";

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
});
