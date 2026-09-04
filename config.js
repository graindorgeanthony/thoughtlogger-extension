// Public runtime configuration. The build script replaces the client ID from
// THOUGHTLOGGER_OAUTH_CLIENT_ID. Never put an OAuth client secret here.
export const CONFIG = Object.freeze({
  supabaseUrl: "https://hjgbnndsobovniflcqcm.supabase.co",
  siteUrl: "https://thoughtlogger.com",
  // OAuth client IDs are public identifiers. This development client is tied
  // to the pinned unpacked-extension ID; production builds can replace it via
  // THOUGHTLOGGER_OAUTH_CLIENT_ID in scripts/build.mjs.
  oauthClientId: "36c1445c-719c-4af2-9754-693b784931bf",
  oauthAuthorizePath: "/auth/v1/oauth/authorize",
  oauthTokenPath: "/auth/v1/oauth/token",
  captureFunctionPath: "/functions/v1/extension-capture",
  alarmName: "thoughtlogger-outbox-retry",
  maxScreenshotBytes: 8 * 1024 * 1024,
});
