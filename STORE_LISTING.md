# Chrome Web Store listing

## Name

ThoughtLogger — Quick Capture

## Short description

Capture notes, pages, selected text, YouTube links, and visible screenshots without leaving your flow.

## Detailed description

ThoughtLogger for Chrome turns the moment you notice something into a journal entry—without opening another tab first.

- Write a note from the toolbar popup.
- Open a floating composer over the page with Cmd/Ctrl+Shift+L.
- Attach the current page only when you choose.
- Paste a link; YouTube links enter ThoughtLogger’s transcript-and-summary pipeline.
- Save a page, selection, or visible screenshot immediately from the context menu.
- Choose Auto filing or one of your visible ThoughtLogger entry types.
- Keep working offline: captures wait safely and retry without duplicates.
- Undo a quick capture or open the resulting journal entry from the confirmation card.

ThoughtLogger does not read page bodies, browser history, or untouched tabs. Nothing is captured until you invoke an extension action.

## Category and language

- Productivity
- English

## Privacy disclosure

The extension handles authentication information and user-generated content. Depending on the deliberate action, content can include notes, selected text, URLs, page titles, and visible screenshots. Local storage is used for tokens, drafts, and failed-upload retry. Data is sent only to ThoughtLogger’s Supabase project and is not sold or used for advertising.

## Reviewer instructions

1. Use the supplied review account or create a ThoughtLogger account.
2. Click the toolbar icon. Confirm OAuth does not open until **Connect ThoughtLogger** is clicked.
3. Log a plain note with Auto selected; confirm the success message and journal entry.
4. Right-click an HTTP(S) page and test Save page and Save selected text.
5. Choose Save visible screenshot; confirm only the viewport is present and the confirmation card offers Undo/Open.
6. Use **Write a quick note here** or Cmd/Ctrl+Shift+L. Verify Escape closes it and focus returns to the prior element.
7. Disable networking, submit a note, and confirm pending badge/outbox feedback. Restore networking and choose Retry or wait for the alarm.
8. Visit `chrome://settings`, open the popup, and confirm page/screenshot controls are disabled with a clear explanation.
9. Disconnect. If the outbox is non-empty, verify the confirmation appears before account data is cleared.

Production submission requires the final Web Store extension ID’s exact OAuth callback to be registered in Supabase and the public production client ID to be supplied at build time.
