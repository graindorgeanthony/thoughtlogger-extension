import { CONFIG } from "../config.js";

export class ApiError extends Error {
  constructor(message, status, code, retryable = false) {
    super(message); this.name = "ApiError"; this.status = status; this.code = code; this.retryable = retryable;
  }
}

export function shouldQueueError(error) {
  return Boolean(error?.retryable || error?.code === "AUTH_REQUIRED" || error?.code === "NETWORK" || error?.status === 401 || error?.status === 408 || error?.status === 429 || error?.status >= 500);
}

async function request(method, accessToken, body, fetchImpl = fetch) {
  let response;
  try {
    response = await fetchImpl(`${CONFIG.supabaseUrl}${CONFIG.captureFunctionPath}`, {
      method,
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("You appear to be offline. The capture is safe in your outbox.", 0, "NETWORK", true);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
    const nestedError = data.error && typeof data.error === "object" ? data.error : null;
    const message = nestedError?.message || (typeof data.error === "string" ? data.error : null) || data.message || `ThoughtLogger returned ${response.status}.`;
    const code = nestedError?.code || data.code || null;
    throw new ApiError(message, response.status, code, retryable);
  }
  return data;
}

export const api = Object.freeze({
  account: (token, fetchImpl) => request("GET", token, null, fetchImpl),
  capture: (token, payload, fetchImpl) => request("POST", token, payload, fetchImpl),
  undo: (token, id, fetchImpl) => request("DELETE", token, { id }, fetchImpl),
});
