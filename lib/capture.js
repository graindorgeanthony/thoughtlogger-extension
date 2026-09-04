export const CAPTURE_KINDS = Object.freeze(["note", "page", "selection", "screenshot"]);

export function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (!isHttpUrl(url.href)) return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

export function extractPastedUrl(value) {
  const text = String(value || "").trim();
  const match = text.match(/(?:https?:\/\/|www\.)[^\s<>]+/i);
  if (!match) return null;
  return normalizeUrl(match[0].replace(/[),.;!?]+$/, ""));
}

export function isYouTubeUrl(value) {
  const normalized = normalizeUrl(value);
  if (!normalized) return false;
  const { hostname, pathname } = new URL(normalized);
  const host = hostname.replace(/^www\./, "").toLowerCase();
  return host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com") ||
    (host === "music.youtube.com" && pathname.length > 1);
}

export function makeCapture(input, uuid = crypto.randomUUID()) {
  const payload = {
    id: uuid,
    kind: input.kind || "note",
    text: String(input.text || "").trim(),
    sourceUrl: input.sourceUrl ? normalizeUrl(input.sourceUrl) : null,
    screenshot: input.screenshot || null,
    typeKey: input.typeKey && input.typeKey !== "auto" ? String(input.typeKey) : null,
    capturedAt: input.capturedAt || new Date().toISOString(),
  };
  const error = validateCapture(payload);
  if (error) throw new Error(error);
  return payload;
}

export function validateCapture(payload) {
  if (!payload || typeof payload !== "object") return "Capture data is missing.";
  if (!CAPTURE_KINDS.includes(payload.kind)) return "That capture kind is not supported.";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.id || "")) {
    return "Capture ID is invalid.";
  }
  if ((payload.text || "").length > 20000) return "Notes must be 20,000 characters or fewer.";
  if (payload.sourceUrl && !isHttpUrl(payload.sourceUrl)) return "Only HTTP or HTTPS pages can be attached.";
  if (payload.sourceUrl && payload.sourceUrl.length > 4096) return "The page URL is too long.";
  if (payload.screenshot && !/^data:image\/(png|jpeg);base64,/i.test(payload.screenshot)) {
    return "The screenshot format is not supported.";
  }
  if (!String(payload.text || "").trim() && !payload.sourceUrl && !payload.screenshot) {
    return "Write a note or add an attachment first.";
  }
  return null;
}

export function contextMenuCapture(info, tab, screenshot = null) {
  const sourceUrl = normalizeUrl(tab?.url);
  const mappings = {
    "thoughtlogger-save-page": { kind: "page", sourceUrl, text: tab?.title || "" },
    "thoughtlogger-save-selection": { kind: "selection", sourceUrl, text: info?.selectionText || "" },
    "thoughtlogger-save-screenshot": { kind: "screenshot", sourceUrl, text: tab?.title || "", screenshot },
  };
  return mappings[info?.menuItemId] || null;
}
