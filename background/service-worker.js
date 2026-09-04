import { CONFIG } from "../config.js";
import { api, ApiError, shouldQueueError } from "../lib/api.js";
import { clearTokens, connect, getAccessToken, getTokens } from "../lib/auth.js";
import { contextMenuCapture, isHttpUrl, makeCapture, normalizeUrl } from "../lib/capture.js";
import {
  clearAccountOutbox, clearDraft, countAllOutbox, failOutbox, getDraft, getOutbox,
  listOutbox, openDatabase, putOutbox, removeOutbox, saveDraft,
} from "../lib/outbox.js";

const ACCOUNT_KEY = "connection.account";
const CONFIG_KEY = "connection.config";
const FEEDBACK_KEY = "last.feedback";
let flushPromise = null;

const menuItems = [
  { id: "thoughtlogger-save-page", title: "Save this page", contexts: ["page"] },
  { id: "thoughtlogger-save-selection", title: "Save selected text", contexts: ["selection"] },
  { id: "thoughtlogger-save-screenshot", title: "Save visible screenshot", contexts: ["page"] },
  { id: "thoughtlogger-quick-note", title: "Write a quick note here", contexts: ["page", "selection"] },
];

async function secureStorage() {
  if (chrome.storage.local.setAccessLevel) {
    await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  }
}

async function createMenus() {
  await chrome.contextMenus.removeAll();
  for (const item of menuItems) chrome.contextMenus.create(item);
}

async function database() { return openDatabase(); }

async function cachedConnection() {
  const values = await chrome.storage.local.get([ACCOUNT_KEY, CONFIG_KEY]);
  return { account: values[ACCOUNT_KEY] || null, config: values[CONFIG_KEY] || null };
}

async function fetchConnection() {
  const token = await getAccessToken();
  const config = await api.account(token);
  const account = config.account;
  await chrome.storage.local.set({ [ACCOUNT_KEY]: account, [CONFIG_KEY]: config });
  return { account, config };
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

function pageFromTab(tab) {
  const supported = Boolean(tab?.url && isHttpUrl(tab.url));
  return { title: tab?.title || "", url: supported ? normalizeUrl(tab.url) : null, supported };
}

async function captureVisible(tab) {
  if (!pageFromTab(tab).supported) throw new Error("ThoughtLogger can only capture regular HTTP or HTTPS pages.");
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "jpeg", quality: 88 });
  const approximateBytes = Math.ceil((dataUrl.length - dataUrl.indexOf(",") - 1) * 3 / 4);
  if (approximateBytes > CONFIG.maxScreenshotBytes) throw new Error("This visible screenshot is too large to save.");
  return dataUrl;
}

async function updateBadge() {
  const pending = await countAllOutbox(await database());
  await chrome.action.setBadgeBackgroundColor({ color: "#4B3D8F" });
  await chrome.action.setBadgeText({ text: pending ? (pending > 99 ? "99+" : String(pending)) : "" });
  await chrome.action.setTitle({ title: pending ? `ThoughtLogger — ${pending} pending` : "Capture in ThoughtLogger" });
  return pending;
}

async function rememberFeedback(feedback) {
  await chrome.storage.local.set({ [FEEDBACK_KEY]: { ...feedback, at: Date.now() } });
}

async function submitQueued(payload) {
  const cached = await cachedConnection();
  if (!cached.account?.id) throw Object.assign(new Error("Connect ThoughtLogger before saving your first capture."), { code: "AUTH_REQUIRED" });
  const db = await database();
  await putOutbox(db, cached.account.id, payload);
  await updateBadge();
  try {
    const token = await getAccessToken();
    const result = await api.capture(token, payload);
    await removeOutbox(db, payload.id);
    await updateBadge();
    const feedback = { status: "saved", entryId: result.entryId || payload.id, message: "Saved to ThoughtLogger." };
    await rememberFeedback(feedback);
    return feedback;
  } catch (error) {
    if (!shouldQueueError(error)) {
      await removeOutbox(db, payload.id);
      await updateBadge();
      throw error;
    }
    const item = await getOutbox(db, payload.id);
    await failOutbox(db, payload.id, (item?.attempts || 0) + 1, true);
    await updateBadge();
    const message = error?.code === "AUTH_REQUIRED"
      ? "Saved locally. Reconnect to send it."
      : error instanceof ApiError && !error.retryable
        ? `Kept in your outbox: ${error.message}`
        : "Saved locally. ThoughtLogger will retry automatically.";
    const feedback = { status: "queued", entryId: payload.id, message };
    await rememberFeedback(feedback);
    return feedback;
  }
}

async function flushOutbox() {
  if (flushPromise) return flushPromise;
  flushPromise = (async () => {
    const { account } = await cachedConnection();
    if (!account?.id) return { sent: 0 };
    const db = await database();
    const items = await listOutbox(db, account.id);
    let sent = 0;
    for (const item of items) {
      if (item.nextAttemptAt > Date.now()) continue;
      try {
        const token = await getAccessToken();
        await api.capture(token, item.payload);
        await removeOutbox(db, item.id);
        sent += 1;
      } catch (error) {
        await failOutbox(db, item.id, item.attempts + 1, shouldQueueError(error));
        if (error?.code === "AUTH_REQUIRED" || error?.status === 401) break;
      }
    }
    await updateBadge();
    return { sent };
  })().finally(() => { flushPromise = null; });
  return flushPromise;
}

async function showPageFeedback(tabId, feedback) {
  if (!tabId) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (detail) => {
        document.getElementById("thoughtlogger-feedback-host")?.remove();
        const host = document.createElement("div");
        host.id = "thoughtlogger-feedback-host";
        const shadow = host.attachShadow({ mode: "closed" });
        const wrap = document.createElement("section");
        wrap.setAttribute("role", "status");
        wrap.setAttribute("aria-live", "polite");
        wrap.style.cssText = "position:fixed;right:20px;bottom:20px;z-index:2147483647;width:min(340px,calc(100vw - 40px));box-sizing:border-box;background:#fff;color:#1B1B1F;border:1px solid #E2E1DF;border-radius:14px;box-shadow:0 18px 50px rgba(27,27,31,.16);padding:16px;font:500 14px/1.45 system-ui,sans-serif;display:grid;gap:12px";
        const label = document.createElement("div");
        label.textContent = detail.message;
        wrap.append(label);
        if (detail.entryId) {
          const actions = document.createElement("div");
          actions.style.cssText = "display:flex;gap:8px;flex-wrap:wrap";
          const button = (text) => { const b = document.createElement("button"); b.textContent = text; b.style.cssText = "min-height:44px;padding:0 14px;border-radius:999px;border:1px solid #D8D4EE;background:#FAF9F6;color:#4B3D8F;font:700 13px system-ui,sans-serif;cursor:pointer"; return b; };
          const undo = button("Undo");
          undo.addEventListener("click", async () => { undo.disabled = true; const result = await chrome.runtime.sendMessage({ type: "UNDO_CAPTURE", id: detail.entryId }); label.textContent = result.ok ? "Capture removed." : result.error; actions.remove(); setTimeout(() => host.remove(), 2500); });
          const open = button("Open");
          open.addEventListener("click", () => chrome.runtime.sendMessage({ type: "OPEN_ENTRY", id: detail.entryId }));
          actions.append(undo, open); wrap.append(actions);
        }
        shadow.append(wrap); document.documentElement.append(host);
        setTimeout(() => host.remove(), 8000);
      },
      args: [feedback],
    });
  } catch {
    // Restricted Chrome pages cannot host injected UI. Popup state and badge still provide feedback.
  }
}

async function undoCapture(id) {
  const db = await database();
  const local = await getOutbox(db, id);
  if (local) {
    await removeOutbox(db, id); await updateBadge();
    return { removed: "local" };
  }
  const token = await getAccessToken();
  return api.undo(token, id);
}

async function injectFloating(tab) {
  const page = pageFromTab(tab);
  if (!page.supported) throw new Error("ThoughtLogger cannot open on Chrome settings, the Web Store, or other internal pages.");
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content/floating-composer.js"] });
}

async function state() {
  const tab = await activeTab();
  const connection = await cachedConnection();
  const tokens = await getTokens();
  const userId = connection.account?.id || null;
  const db = await database();
  const draft = await getDraft(db, userId);
  const values = await chrome.storage.local.get(FEEDBACK_KEY);
  return {
    connected: Boolean(tokens?.accessToken && userId),
    account: connection.account,
    types: connection.config?.types || [],
    quota: connection.config?.quota || null,
    page: pageFromTab(tab),
    draft,
    pending: userId ? (await listOutbox(db, userId)).length : await countAllOutbox(db),
    feedback: values[FEEDBACK_KEY] || null,
  };
}

async function onMessage(message) {
  switch (message?.type) {
    case "GET_STATE": return { ok: true, state: await state() };
    case "CONNECT": {
      await connect();
      try {
        const connection = await fetchConnection(); await flushOutbox();
        return { ok: true, state: { ...(await state()), ...connection } };
      } catch (error) {
        await clearTokens(); throw error;
      }
    }
    case "REFRESH_CONNECTION": return { ok: true, state: { ...(await state()), ...(await fetchConnection()) } };
    case "DISCONNECT": {
      const { account } = await cachedConnection(); const db = await database();
      if (message.clearQueue && account?.id) await clearAccountOutbox(db, account.id);
      if (account?.id) await clearDraft(db, account.id);
      await clearTokens(); await chrome.storage.local.remove([ACCOUNT_KEY, CONFIG_KEY, FEEDBACK_KEY]); await updateBadge();
      return { ok: true };
    }
    case "SAVE_DRAFT": {
      const { account } = await cachedConnection(); await saveDraft(await database(), account?.id, message.draft || {}); return { ok: true };
    }
    case "CLEAR_DRAFT": {
      const { account } = await cachedConnection(); await clearDraft(await database(), account?.id); return { ok: true };
    }
    case "CAPTURE_SCREENSHOT": return { ok: true, screenshot: await captureVisible(await activeTab()) };
    case "SUBMIT_CAPTURE": {
      const payload = makeCapture(message.capture); const result = await submitQueued(payload); await clearDraft(await database(), (await cachedConnection()).account?.id);
      return { ok: true, result };
    }
    case "UNDO_CAPTURE": return { ok: true, result: await undoCapture(message.id) };
    case "OPEN_ENTRY": {
      const local = message.id ? await getOutbox(await database(), message.id) : null;
      const url = message.id && !local ? `${CONFIG.siteUrl}/journal/${encodeURIComponent(message.id)}` : `${CONFIG.siteUrl}/journal`;
      await chrome.tabs.create({ url }); return { ok: true };
    }
    case "OPEN_APP": await chrome.tabs.create({ url: `${CONFIG.siteUrl}/journal` }); return { ok: true };
    case "OPEN_FLOATING": await injectFloating(await activeTab()); return { ok: true };
    case "RETRY_OUTBOX": return { ok: true, result: await flushOutbox() };
    default: return { ok: false, error: "Unknown extension action." };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  onMessage(message).then(sendResponse).catch((error) => sendResponse({ ok: false, error: error?.message || "Unexpected extension error.", code: error?.code }));
  return true;
});

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await secureStorage(); await createMenus(); await updateBadge();
  if (reason === "install") await chrome.tabs.create({ url: chrome.runtime.getURL("welcome/welcome.html") });
});

chrome.runtime.onStartup.addListener(async () => { await secureStorage(); await createMenus(); await flushOutbox(); });
chrome.alarms.create(CONFIG.alarmName, { delayInMinutes: 1, periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === CONFIG.alarmName) flushOutbox(); });
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "open-floating-composer") return;
  const tab = await activeTab();
  try { await injectFloating(tab); } catch (error) { await rememberFeedback({ status: "error", message: error.message }); }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === "thoughtlogger-quick-note") { await injectFloating(tab); return; }
    if (!pageFromTab(tab).supported) throw new Error("Only regular HTTP or HTTPS pages can be captured.");
    const screenshot = info.menuItemId === "thoughtlogger-save-screenshot" ? await captureVisible(tab) : null;
    const raw = contextMenuCapture(info, tab, screenshot);
    if (!raw) return;
    const result = await submitQueued(makeCapture(raw));
    await showPageFeedback(tab.id, result);
  } catch (error) {
    const feedback = { status: "error", message: error?.message || "Capture failed." };
    await rememberFeedback(feedback); await showPageFeedback(tab?.id, feedback);
  }
});

globalThis.addEventListener?.("online", () => flushOutbox());
