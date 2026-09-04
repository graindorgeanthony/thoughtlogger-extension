const button = document.querySelector("#connect");
const status = document.querySelector("#status");

function setBusy(busy, label) {
  button.disabled = busy;
  button.setAttribute("aria-busy", String(busy));
  button.textContent = label;
}

function showConnected(state, automatic = false) {
  setBusy(true, "Connected");
  const account = state.account?.email ? ` as ${state.account.email}` : "";
  status.textContent = automatic
    ? `Found your ThoughtLogger session${account}. You’re ready to capture.`
    : `Ready to capture${account}. Pin the extension for one-click access.`;
}

async function connectInteractively() {
  setBusy(true, "Connecting…");
  status.textContent = "A secure ThoughtLogger window is opening.";
  try {
    const response = await chrome.runtime.sendMessage({ type: "CONNECT" });
    if (!response.ok) throw new Error(response.error);
    showConnected(response.state);
  } catch (error) {
    setBusy(false, "Connect ThoughtLogger");
    status.textContent = error?.message || "ThoughtLogger could not connect. Please try again.";
  }
}

async function initialize() {
  try {
    const current = await chrome.runtime.sendMessage({ type: "GET_STATE" });
    if (!current.ok) throw new Error(current.error);
    if (current.state.connected) {
      showConnected(current.state);
      return;
    }

    setBusy(true, "Checking your account…");
    status.textContent = "Looking for an existing ThoughtLogger session in this browser.";
    const silent = await chrome.runtime.sendMessage({ type: "CONNECT_SILENT" });
    if (silent.ok && silent.state.connected) {
      showConnected(silent.state, true);
      return;
    }
    setBusy(false, "Connect ThoughtLogger");
    status.textContent = "No active session found. Connect once to get started.";
  } catch {
    setBusy(false, "Connect ThoughtLogger");
    status.textContent = "We couldn’t check your session. You can still connect securely.";
  }
}

button.addEventListener("click", connectInteractively);
initialize();
