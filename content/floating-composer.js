(() => {
  const existing = document.getElementById("thoughtlogger-floating-host");
  if (existing) { existing.dispatchEvent(new CustomEvent("thoughtlogger-focus")); return; }
  const previousFocus = document.activeElement;
  const host = document.createElement("div"); host.id = "thoughtlogger-floating-host";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host{all:initial;color-scheme:light;--paper:#faf9f6;--card:#fff;--ink:#1b1b1f;--soft:#6c6c76;--violet:#4b3d8f;--wash:#efeaff;--line:#e2e1df;font-family:system-ui,-apple-system,sans-serif}
      *{box-sizing:border-box}.backdrop{position:fixed;inset:0;z-index:2147483646;background:rgba(27,27,31,.18)}.panel{position:fixed;z-index:2147483647;right:24px;top:24px;width:min(430px,calc(100vw - 32px));max-height:calc(100vh - 48px);overflow:auto;background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:22px;box-shadow:0 24px 70px rgba(27,27,31,.22);padding:20px}
      header{display:flex;align-items:start;justify-content:space-between;gap:16px;margin-bottom:16px}.eyebrow{font:700 11px/1.2 ui-monospace,monospace;letter-spacing:.16em;color:#73737d;margin:0 0 7px}.title{font:400 30px/1.05 Georgia,serif;margin:0}.close{width:44px;height:44px;flex:none;border:0;border-radius:999px;background:var(--paper);color:var(--soft);font-size:25px;cursor:pointer}
      form{display:grid;gap:12px}label{font-size:12px;font-weight:700;color:var(--soft)}textarea{border:0;border-bottom:1px solid var(--line);padding:4px 0 12px;resize:vertical;min-height:128px;font:400 16px/1.5 system-ui,sans-serif;color:var(--ink)}textarea::placeholder{color:#92929b}button,select{font:inherit}button{cursor:pointer}button:focus-visible,textarea:focus,select:focus{outline:3px solid rgba(75,61,143,.3);outline-offset:2px}.chips{display:flex;flex-wrap:wrap;gap:8px}.chip{display:flex;align-items:center;max-width:100%;min-height:36px;padding-left:11px;background:var(--wash);color:var(--violet);border-radius:9px;font-size:12px}.chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.chip button{width:36px;height:36px;border:0;background:transparent;color:inherit;font-size:20px}
      .tools{display:flex;gap:8px;flex-wrap:wrap}.secondary{min-height:44px;padding:0 13px;border:1px solid var(--line);border-radius:10px;background:var(--paper);color:var(--soft);font-weight:700;font-size:12px}.secondary[aria-pressed=true]{background:var(--wash);color:var(--violet);border-color:#c9c2eb}.foot{display:flex;align-items:end;justify-content:space-between;gap:12px;border-top:1px solid var(--line);padding-top:14px}.type{display:grid;gap:5px}.type select{height:44px;border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--ink);padding:0 32px 0 13px}.submit{min-height:44px;padding:0 23px;border:0;border-radius:999px;background:var(--violet);color:#fff;font-weight:700}.submit:disabled{opacity:.5;cursor:not-allowed}.status{min-height:20px;margin:0;font-size:13px;line-height:1.4;color:var(--soft)}.status.error{color:#a3262d}.status.success{color:#2c6a4f}.open{min-height:44px;border:0;background:transparent;color:var(--violet);font-weight:700;padding:0}
      @media(max-width:520px){.panel{right:16px;top:16px;max-height:calc(100vh - 32px)}}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
    </style>
    <div class="backdrop" aria-hidden="true"></div>
    <section class="panel" role="dialog" aria-modal="true" aria-labelledby="tl-title">
      <header><div><p class="eyebrow">QUICK CAPTURE</p><h2 class="title" id="tl-title">What caught your attention?</h2></div><button class="close" type="button" aria-label="Close composer">×</button></header>
      <form><label for="tl-note">Note</label><textarea id="tl-note" maxlength="20000" rows="5" placeholder="Half a sentence is fine. Really."></textarea><div class="chips" aria-live="polite"></div>
        <div class="tools"><button class="secondary page" type="button" aria-pressed="false">Attach this page</button><button class="secondary shot" type="button" aria-pressed="false">Visible screenshot</button></div>
        <div class="foot"><div class="type"><label for="tl-type">File as</label><select id="tl-type"><option value="auto">Auto</option></select></div><button class="submit" type="submit">Log it</button></div>
        <p class="status" role="status" aria-live="polite"></p><button class="open" type="button">Open in ThoughtLogger</button>
      </form>
    </section>`;
  document.documentElement.append(host);
  const $ = (selector) => shadow.querySelector(selector);
  let page = null; let attachment = { sourceUrl: null, screenshot: null }; let draftTimer;
  const send = (message) => chrome.runtime.sendMessage(message);
  const status = (text = "", kind = "") => { $(".status").textContent = text; $(".status").className = `status ${kind}`; };
  const close = () => { host.remove(); if (previousFocus?.isConnected) previousFocus.focus(); };
  const render = () => {
    const root = $(".chips"); root.replaceChildren();
    if (attachment.sourceUrl) {
      const chip = document.createElement("div"); chip.className = "chip";
      const label = document.createElement("span");
      try { const url = new URL(attachment.sourceUrl); label.textContent = `${attachment.screenshot ? "Screenshot" : "Link"} · ${url.hostname}`; } catch { label.textContent = "Page attached"; }
      const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "×"; remove.setAttribute("aria-label", "Remove page attachment");
      remove.onclick = () => { attachment = { sourceUrl: null, screenshot: null }; render(); saveDraft(); };
      chip.append(label, remove); root.append(chip);
    }
    $(".page").setAttribute("aria-pressed", String(Boolean(attachment.sourceUrl)));
    $(".shot").setAttribute("aria-pressed", String(Boolean(attachment.screenshot)));
  };
  const saveDraft = () => { clearTimeout(draftTimer); draftTimer = setTimeout(() => send({ type: "SAVE_DRAFT", draft: { text: $("textarea").value, typeKey: $("select").value, ...attachment } }), 250); };
  $(".close").onclick = close; $(".backdrop").onclick = close;
  $("textarea").addEventListener("input", saveDraft); $("select").addEventListener("change", saveDraft);
  $("textarea").addEventListener("paste", (event) => {
    if (attachment.sourceUrl) return;
    const value = event.clipboardData?.getData("text")?.trim(); if (!/^https?:\/\/\S+$/i.test(value || "")) return;
    event.preventDefault(); attachment.sourceUrl = value; render(); saveDraft();
    status(/(?:youtu\.be|youtube\.com)/i.test(value) ? "YouTube link attached. ThoughtLogger will fetch its transcript when available." : "Link attached.");
  });
  $(".page").onclick = () => { if (!page?.supported) return; attachment.sourceUrl = attachment.sourceUrl ? null : page.url; if (!attachment.sourceUrl) attachment.screenshot = null; render(); saveDraft(); };
  $(".shot").onclick = async () => {
    $(".shot").disabled = true; status("Capturing the visible viewport…");
    const response = await send({ type: "CAPTURE_SCREENSHOT" }); $(".shot").disabled = false;
    if (!response.ok) { status(response.error, "error"); return; }
    attachment = { sourceUrl: page.url, screenshot: response.screenshot }; render(); saveDraft(); status("Visible screenshot attached.", "success");
  };
  $(".open").onclick = () => send({ type: "OPEN_APP" });
  $("form").onsubmit = async (event) => {
    event.preventDefault(); const submit = $(".submit"); submit.disabled = true; submit.textContent = "Logging…"; status();
    const response = await send({ type: "SUBMIT_CAPTURE", capture: { kind: attachment.screenshot ? "screenshot" : attachment.sourceUrl ? "page" : "note", text: $("textarea").value, typeKey: $("select").value, ...attachment } });
    submit.disabled = false; submit.textContent = "Log it";
    if (!response.ok) { status(response.error, "error"); return; }
    $("textarea").value = ""; $("select").value = "auto"; attachment = { sourceUrl: null, screenshot: null }; render(); status(response.result.message, response.result.status === "saved" ? "success" : "");
  };
  shadow.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); if ((event.metaKey || event.ctrlKey) && event.key === "Enter") $("form").requestSubmit(); });
  host.addEventListener("thoughtlogger-focus", () => $("textarea").focus());
  send({ type: "GET_STATE" }).then((response) => {
    if (!response.ok) throw new Error(response.error); const state = response.state;
    if (!state.connected) throw new Error("Open the ThoughtLogger toolbar button to connect first.");
    page = state.page; $(".page").disabled = !page.supported; $(".shot").disabled = !page.supported;
    for (const item of state.types || []) $("select").add(new Option(`${item.emoji || ""} ${item.label}`.trim(), item.key));
    const draft = state.draft || {}; $("textarea").value = draft.text || ""; $("select").value = draft.typeKey || "auto"; attachment = { sourceUrl: draft.sourceUrl || null, screenshot: draft.screenshot || null }; render();
    if (!page.supported) status("Page attachments are unavailable here."); $("textarea").focus();
  }).catch((error) => { status(error.message, "error"); $(".submit").disabled = true; $("textarea").focus(); });
})();
