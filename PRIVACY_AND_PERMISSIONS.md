# Privacy and permission justifications

ThoughtLogger transmits data only after a deliberate capture action. Depending on that action, the payload can contain a user-written note, selected text, the active page URL/title, or a visible-viewport screenshot. It also contains a client-generated capture ID, local capture time, capture kind, and optional entry type. Failed captures and drafts are stored locally until sent or deleted.

## Permissions

- **activeTab**: temporary access to the current tab after the toolbar, context-menu, or keyboard action. Used to identify the chosen page and authorize a visible screenshot.
- **scripting**: injects the floating composer or a short confirmation card after the user invokes it. There are no persistent content scripts.
- **contextMenus**: exposes Save page, Save selected text, Save visible screenshot, and Quick note actions.
- **identity**: opens ThoughtLogger’s OAuth consent flow with an exact `chromiumapp.org` callback, PKCE, and CSRF state.
- **storage**: keeps rotating OAuth tokens, cached visible entry types, UI state, and preferences in extension storage. IndexedDB stores drafts and the retry outbox.
- **alarms**: performs bounded retry attempts for queued captures.
- **Host permission — `https://hjgbnndsobovniflcqcm.supabase.co/*`**: reaches only ThoughtLogger’s Supabase OAuth/token endpoints and `extension-capture` Edge Function.

The extension does not request `tabs`, `<all_urls>`, browser history, notifications, clipboard access, or background page access. It does not sell data, perform advertising profiling, or remotely execute code.

## Authentication and retention

The client is public and has no embedded secret. Access/rotating refresh tokens remain in Chrome extension-local storage and are never exposed to injected page UI. Disconnect clears tokens, cached types, and drafts; if captures remain queued, the user must confirm whether to clear that account’s unsent queue. Successfully delivered captures are removed from local outbox storage. Server retention then follows the ThoughtLogger privacy policy and account controls.
