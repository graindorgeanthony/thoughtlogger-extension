const $ = (selector) => document.querySelector(selector);
const demo = new URLSearchParams(location.search).has("demo");
let state = null;
let attachment = { sourceUrl: null, screenshot: null };
let saveTimer = null;

function send(message) {
  if (demo) return Promise.resolve({ ok: true });
  return chrome.runtime.sendMessage(message);
}

function setStatus(message = "", kind = "") {
  const node = $("#status"); node.textContent = message; node.className = `status ${kind}`;
}

function setLoading(loading) {
  $("#submit").disabled = loading; $("#submit").classList.toggle("loading", loading);
  $("#submit-label").textContent = loading ? "Logging…" : "Log it";
}

function displayUrl(value) {
  try { const url = new URL(value); return `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`; } catch { return value; }
}

function renderAttachments() {
  const root = $("#attachments"); root.replaceChildren();
  if (attachment.sourceUrl) {
    const chip = document.createElement("div"); chip.className = "chip";
    const label = document.createElement("span"); label.textContent = `${attachment.screenshot ? "Screenshot · " : "Link · "}${displayUrl(attachment.sourceUrl)}`;
    const remove = document.createElement("button"); remove.type = "button"; remove.setAttribute("aria-label", "Remove page attachment"); remove.textContent = "×";
    remove.onclick = () => { attachment = { sourceUrl: null, screenshot: null }; renderAttachments(); persistDraft(); };
    chip.append(label, remove); root.append(chip);
  }
  $("#attach-page").setAttribute("aria-pressed", String(Boolean(attachment.sourceUrl)));
  $("#screenshot").setAttribute("aria-pressed", String(Boolean(attachment.screenshot)));
}

function persistDraft() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => send({ type: "SAVE_DRAFT", draft: { text: $("#note").value, typeKey: $("#type").value, ...attachment } }), 250);
}

function applyState(next) {
  state = next;
  $("#connect-view").hidden = next.connected;
  $("#composer").hidden = !next.connected;
  $("#connected-footer").hidden = !next.connected;
  $("#pending").hidden = !next.pending;
  $("#pending").textContent = next.pending ? `${next.pending} pending` : "";
  if (!next.connected) return;
  const type = $("#type"); type.replaceChildren(new Option("Auto", "auto"));
  for (const item of next.types || []) type.add(new Option(`${item.emoji || ""} ${item.label}`.trim(), item.key));
  const draft = next.draft || {};
  $("#note").value = draft.text || ""; type.value = draft.typeKey || "auto";
  attachment = { sourceUrl: draft.sourceUrl || null, screenshot: draft.screenshot || null }; renderAttachments();
  if (!next.page.supported) {
    $("#attach-page").disabled = true; $("#screenshot").disabled = true;
    setStatus("Page attachments are unavailable on Chrome’s internal pages.");
  } else if (next.feedback && Date.now() - next.feedback.at < 10000) {
    setStatus(next.feedback.message, next.feedback.status === "error" ? "error" : "success");
  }
  setTimeout(() => $("#note").focus(), 0);
}

async function load() {
  if (demo) {
    applyState({ connected: true, pending: 2, page: { supported: true, title: "Designing for attention", url: "https://example.com/article" }, types: [{ key: "idea", emoji: "💡", label: "Idea" }], draft: { text: "The best capture tool should disappear into the moment." } });
    attachment.sourceUrl = "https://example.com/article"; renderAttachments(); return;
  }
  const response = await send({ type: "GET_STATE" });
  if (!response.ok) throw new Error(response.error); applyState(response.state);
}

$("#connect").addEventListener("click", async () => {
  $("#connect").disabled = true; $("#connect").textContent = "Connecting…";
  try { const response = await send({ type: "CONNECT" }); if (!response.ok) throw new Error(response.error); applyState(response.state); }
  catch (error) { $("#connect").disabled = false; $("#connect").textContent = "Connect ThoughtLogger"; alert(error.message); }
});
$("#note").addEventListener("input", persistDraft);
$("#note").addEventListener("paste", (event) => {
  if (attachment.sourceUrl) return;
  const value = event.clipboardData?.getData("text")?.trim();
  if (!/^https?:\/\/\S+$/i.test(value || "")) return;
  event.preventDefault(); attachment.sourceUrl = value; renderAttachments(); persistDraft();
  setStatus(/(?:youtu\.be|youtube\.com)/i.test(value) ? "YouTube link attached. ThoughtLogger will fetch its transcript when available." : "Link attached.");
});
$("#type").addEventListener("change", persistDraft);
$("#attach-page").addEventListener("click", () => {
  if (!state.page.supported) return;
  attachment.sourceUrl = attachment.sourceUrl ? null : state.page.url; if (!attachment.sourceUrl) attachment.screenshot = null;
  renderAttachments(); persistDraft();
});
$("#screenshot").addEventListener("click", async () => {
  setStatus("Capturing the visible viewport…"); $("#screenshot").disabled = true;
  try { const response = await send({ type: "CAPTURE_SCREENSHOT" }); if (!response.ok) throw new Error(response.error); attachment = { sourceUrl: state.page.url, screenshot: response.screenshot }; renderAttachments(); persistDraft(); setStatus("Visible screenshot attached.", "success"); }
  catch (error) { setStatus(error.message, "error"); } finally { $("#screenshot").disabled = false; }
});
$("#floating").addEventListener("click", async () => {
  const response = await send({ type: "OPEN_FLOATING" }); if (!response.ok) setStatus(response.error, "error"); else window.close();
});
$("#composer").addEventListener("submit", async (event) => {
  event.preventDefault(); setLoading(true); setStatus("");
  try {
    const response = await send({ type: "SUBMIT_CAPTURE", capture: { kind: attachment.screenshot ? "screenshot" : attachment.sourceUrl ? "page" : "note", text: $("#note").value, typeKey: $("#type").value, ...attachment } });
    if (!response.ok) throw new Error(response.error);
    $("#note").value = ""; $("#type").value = "auto"; attachment = { sourceUrl: null, screenshot: null }; renderAttachments();
    setStatus(response.result.message, response.result.status === "saved" ? "success" : ""); state.pending += response.result.status === "queued" ? 1 : 0;
  } catch (error) { setStatus(error.message, "error"); } finally { setLoading(false); }
});
document.addEventListener("keydown", (event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") $("#composer").requestSubmit(); });
$("#open-app").addEventListener("click", () => send({ type: "OPEN_APP" }));
$("#disconnect").addEventListener("click", async () => {
  const clearQueue = state.pending ? confirm(`${state.pending} capture(s) are waiting to send. Disconnecting can clear them. Choose OK to clear and disconnect, or Cancel to keep working.`) : true;
  if (state.pending && !clearQueue) return;
  await send({ type: "DISCONNECT", clearQueue }); location.reload();
});

load().catch((error) => { $("#connect-view").hidden = false; $("#connect-view p:not(.eyebrow)").textContent = error.message; });
