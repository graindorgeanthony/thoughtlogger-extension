// Public runtime configuration. The build script replaces the client ID from
// THOUGHTLOGGER_OAUTH_CLIENT_ID. Never put an OAuth client secret here.
export const CONFIG = Object.freeze({
  supabaseUrl: "https://hjgbnndsobovniflcqcm.supabase.co",
  siteUrl: "https://thoughtlogger.com",
  oauthClientId: "__THOUGHTLOGGER_OAUTH_CLIENT_ID__",
  oauthAuthorizePath: "/auth/v1/oauth/authorize",
  oauthTokenPath: "/auth/v1/oauth/token",
  captureFunctionPath: "/functions/v1/extension-capture",
  alarmName: "thoughtlogger-outbox-retry",
  maxScreenshotBytes: 8 * 1024 * 1024,
});
