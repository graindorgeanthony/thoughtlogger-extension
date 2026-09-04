# ThoughtLogger Chrome Extension

A permission-minimal Manifest V3 extension for deliberate, low-friction capture into [ThoughtLogger](https://thoughtlogger.com). It supports toolbar notes, a floating Shadow DOM composer, page/selection/screenshot context actions, pasted links (including YouTube), draft autosave, and an account-isolated offline outbox.

## Local setup

1. In Supabase OAuth Server, create a **public** client using Authorization Code + PKCE and `token_endpoint_auth_method=none`. Do not create or embed a client secret.
2. Load the unpacked source once at `chrome://extensions` to learn its development ID. Register the exact callback shown by `chrome.identity.getRedirectURL("oauth2")`, which has the form `https://<extension-id>.chromiumapp.org/oauth2`.
3. The tracked development build already contains the public client ID for the
   pinned unpacked-extension callback. To build for another extension ID, supply
   that extension's public client ID:

   ```sh
   npm install
   THOUGHTLOGGER_OAUTH_CLIENT_ID=your-public-client-id npm run build
   ```

4. Load `dist/` as an unpacked extension. The welcome page silently checks for
   an existing ThoughtLogger website session. It connects automatically when
   one is available; otherwise the user can choose **Connect ThoughtLogger**.

Use separate development and production OAuth clients. Once the Chrome Web Store creates the production extension ID, register that extension’s exact callback, add its exact client/callback pair to ThoughtLogger's first-party allowlist, and pin the production ID through the store/public-key workflow. OAuth client IDs are public identifiers; the extension never contains a client secret.

## Commands

- `npm test` — pure contract, OAuth, API, outbox, permission, and accessibility tests.
- `npm run build` — clean MV3 bundle in `dist/`; rejects remote/dynamic executable code.
- `npm run package` — clean bundle plus `release/thoughtlogger-extension-<version>.zip`.
- `npm run verify` — tests and release ZIP.

## Architecture and privacy boundary

- The service worker is the only code that receives OAuth tokens or calls the ThoughtLogger API.
- The welcome screen may attempt non-interactive OAuth. ThoughtLogger connects
  automatically only when its same-origin website session is already valid and
  the exact first-party OAuth client and Chrome callback both match.
- Tokens use extension-local storage restricted to trusted extension contexts. Drafts and queued captures use IndexedDB.
- Every capture is persisted before upload. Its client UUID becomes the server entry UUID, so retries are idempotent.
- Queue records carry the connected ThoughtLogger user ID. A record is never sent while another account is active.
- `activeTab` access is temporary and user-gesture scoped. The extension has no `tabs` permission, no `<all_urls>`, no notification permission, and no persistent content script.
- Screenshot capture is limited to the visible viewport and only follows an explicit button/menu action.
- Page bodies, browser history, and inactive tabs are never read.

See [PRIVACY_AND_PERMISSIONS.md](PRIVACY_AND_PERMISSIONS.md) for store-facing justifications and [STORE_LISTING.md](STORE_LISTING.md) for publishing copy and reviewer steps.
