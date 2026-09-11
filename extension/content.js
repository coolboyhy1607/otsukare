// Bridges the otsukare page and the extension via window.postMessage.
// The page can't call the extension directly, but a content script shares the page's window.
const TAG = "otsukare-ext";

const send = (msg) => window.postMessage({ __src: TAG, ...msg }, window.location.origin);

// Announce presence on load so the page knows the extension is here even before it pings.
send({ type: "ready" });

window.addEventListener("message", (e) => {
  if (e.source !== window || e.data?.__src !== "otsukare-page") return;
  if (e.data.type === "ping") send({ type: "pong" });
  if (e.data.type === "getTokens") {
    chrome.runtime.sendMessage({ type: "getTokens" }, (tokens) => send({ type: "tokens", tokens: tokens || {} }));
  }
});
