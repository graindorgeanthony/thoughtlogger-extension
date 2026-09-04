import { describe, expect, it, vi } from "vitest";
import { api, ApiError, shouldQueueError } from "../lib/api.js";
describe("capture API", () => {
  it("sends bearer auth and JSON", async () => {
    const fetchImpl = vi.fn(async (_url, init) => ({ ok: true, json: async () => ({ entryId: "id" }), init }));
    await expect(api.capture("token", { id: "id" }, fetchImpl)).resolves.toEqual({ entryId: "id" });
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe("Bearer token");
  });
  it("marks network and server failures retryable", async () => {
    await expect(api.capture("token", {}, async () => { throw new Error("offline"); })).rejects.toMatchObject({ code: "NETWORK", retryable: true });
    await expect(api.capture("token", {}, async () => ({ ok: false, status: 503, json: async () => ({ error: "later" }) }))).rejects.toBeInstanceOf(ApiError);
  });
  it("preserves nested backend error codes and human-readable messages", async () => {
    const fetchImpl = async () => ({ ok: false, status: 429, json: async () => ({ error: { code: "QUOTA_EXHAUSTED", message: "Monthly capture quota reached." } }) });
    await expect(api.capture("token", {}, fetchImpl)).rejects.toMatchObject({
      code: "QUOTA_EXHAUSTED", message: "Monthly capture quota reached.", retryable: true,
    });
  });
  it("queues only recoverable transport/auth/quota failures", () => {
    expect(shouldQueueError(new ApiError("offline", 0, "NETWORK", true))).toBe(true);
    expect(shouldQueueError(new ApiError("reconnect", 401, "INVALID_TOKEN"))).toBe(true);
    expect(shouldQueueError(new ApiError("quota", 429, "QUOTA_EXHAUSTED", true))).toBe(true);
    expect(shouldQueueError(new ApiError("hidden type", 400, "INVALID_TYPE"))).toBe(false);
    expect(shouldQueueError(new ApiError("wrong client", 403, "WRONG_CLIENT"))).toBe(false);
  });
});
