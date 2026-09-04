const button = document.querySelector("#connect");
const status = document.querySelector("#status");
button.addEventListener("click", async () => {
  button.disabled = true; button.textContent = "Connecting…"; status.textContent = "A secure ThoughtLogger window is opening.";
  const response = await chrome.runtime.sendMessage({ type: "CONNECT" });
  if (response.ok) { button.textContent = "Connected"; status.textContent = `Ready to capture${response.state.account?.email ? ` as ${response.state.account.email}` : ""}. Pin the extension for one-click access.`; return; }
  button.disabled = false; button.textContent = "Connect ThoughtLogger"; status.textContent = response.error;
});
chrome.runtime.sendMessage({ type: "GET_STATE" }).then((response) => {
  if (!response.ok || !response.state.connected) return;
  button.disabled = true; button.textContent = "Connected"; status.textContent = "ThoughtLogger is connected and ready to capture.";
});
