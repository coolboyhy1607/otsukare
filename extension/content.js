// Bridges the otsukare page and the extension via window.postMessage.
// The page can't call the extension directly, but a content script shares the page's window.
const TAG = "otsukare-ext";

const send = (msg) => window.postMessage({ __src: TAG, ...msg }, window.location.origin);

window.addEventListener("message", (e) => {
  if (e.source !== window || e.data?.__src !== "otsukare-page") return;
  // pong carries the consent state so the page can show "未同意" and skip auto-fill until agreed.
  if (e.data.type === "ping") {
    chrome.storage.local.get("consent").then(({ consent }) => send({ type: "pong", consent: consent === true }));
  }
  if (e.data.type === "getTokens") {
    chrome.runtime.sendMessage({ type: "getTokens" }, (tokens) => send({ type: "tokens", tokens: tokens || {} }));
  }
});
