import { CONFIG } from "../config.js";

const TOKEN_KEY = "auth.tokens";
const PKCE_KEY = "auth.pkce";

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomUrlSafe(byteLength = 32, cryptoImpl = crypto) {
  return base64Url(cryptoImpl.getRandomValues(new Uint8Array(byteLength)));
}

export async function createPkce(cryptoImpl = crypto) {
  const verifier = randomUrlSafe(64, cryptoImpl);
  const digest = await cryptoImpl.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64Url(new Uint8Array(digest)), state: randomUrlSafe(32, cryptoImpl) };
}

export function validateOAuthCallback(callbackUrl, expectedRedirect, expectedState) {
  const callback = new URL(callbackUrl);
  const expected = new URL(expectedRedirect);
  if (callback.origin !== expected.origin || callback.pathname !== expected.pathname) throw new Error("OAuth redirect did not match.");
  if (!callback.searchParams.get("state") || callback.searchParams.get("state") !== expectedState) throw new Error("OAuth state did not match.");
  const oauthError = callback.searchParams.get("error_description") || callback.searchParams.get("error");
  if (oauthError) throw new Error(oauthError);
  const code = callback.searchParams.get("code");
  if (!code) throw new Error("OAuth server did not return a code.");
  return code;
}

function configuredClientId() {
  if (!CONFIG.oauthClientId || CONFIG.oauthClientId.includes("__THOUGHTLOGGER")) {
    throw new Error("This build needs a ThoughtLogger OAuth client ID. See README.md.");
  }
  return CONFIG.oauthClientId;
}

async function tokenRequest(fields, fetchImpl = fetch) {
  const response = await fetchImpl(`${CONFIG.supabaseUrl}${CONFIG.oauthTokenPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(fields),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error_description || body.error || "ThoughtLogger sign-in failed.");
  const expiresIn = Number(body.expires_in || 3600);
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: Date.now() + expiresIn * 1000,
    tokenType: body.token_type || "Bearer",
  };
}

export async function connect({
  storage = chrome.storage.local,
  identity = chrome.identity,
  fetchImpl = fetch,
  interactive = true,
} = {}) {
  const clientId = configuredClientId();
  const redirectUri = identity.getRedirectURL("oauth2");
  const pkce = await createPkce();
  await storage.set({ [PKCE_KEY]: { ...pkce, redirectUri, createdAt: Date.now() } });
  const authorize = new URL(`${CONFIG.supabaseUrl}${CONFIG.oauthAuthorizePath}`);
  authorize.search = new URLSearchParams({
    response_type: "code", client_id: clientId, redirect_uri: redirectUri,
    code_challenge: pkce.challenge, code_challenge_method: "S256", state: pkce.state,
  }).toString();
  try {
    const flow = interactive
      ? { url: authorize.href, interactive: true }
      : {
          url: authorize.href,
          interactive: false,
          // ThoughtLogger's consent route uses JavaScript to inspect the
          // existing same-origin web session and complete the redirect.
          abortOnLoadForNonInteractive: false,
          timeoutMsForNonInteractive: 8_000,
        };
    const callbackUrl = await identity.launchWebAuthFlow(flow);
    if (!callbackUrl) throw new Error("ThoughtLogger did not complete sign-in.");
    const code = validateOAuthCallback(callbackUrl, redirectUri, pkce.state);
    const tokens = await tokenRequest({
      grant_type: "authorization_code", code, client_id: clientId,
      redirect_uri: redirectUri, code_verifier: pkce.verifier,
    }, fetchImpl);
    await storage.set({ [TOKEN_KEY]: tokens });
    return tokens;
  } finally {
    // A cancelled or unavailable silent flow must never leave stale state that
    // could be mistaken for a later interactive authorization.
    await storage.remove(PKCE_KEY);
  }
}

export async function getTokens(storage = chrome.storage.local) {
  return (await storage.get(TOKEN_KEY))[TOKEN_KEY] || null;
}

export async function clearTokens(storage = chrome.storage.local) {
  await storage.remove([TOKEN_KEY, PKCE_KEY]);
}

export async function getAccessToken({ storage = chrome.storage.local, fetchImpl = fetch, minValidityMs = 60_000, clientId } = {}) {
  const tokens = await getTokens(storage);
  if (!tokens?.accessToken) throw Object.assign(new Error("Connect ThoughtLogger to continue."), { code: "AUTH_REQUIRED" });
  if (tokens.expiresAt - Date.now() > minValidityMs) return tokens.accessToken;
  if (!tokens.refreshToken) throw Object.assign(new Error("Reconnect ThoughtLogger to continue."), { code: "AUTH_REQUIRED" });
  try {
    const next = await tokenRequest({
      grant_type: "refresh_token", refresh_token: tokens.refreshToken, client_id: clientId || configuredClientId(),
    }, fetchImpl);
    if (!next.refreshToken) next.refreshToken = tokens.refreshToken;
    await storage.set({ [TOKEN_KEY]: next });
    return next.accessToken;
  } catch (error) {
    await clearTokens(storage);
    throw Object.assign(new Error("Your connection expired. Reconnect ThoughtLogger."), { code: "AUTH_REQUIRED", cause: error });
  }
}
