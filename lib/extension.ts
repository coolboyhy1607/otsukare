// Talks to the "otsukare token filler" extension via window.postMessage (a content script relays
// to the extension). No extension ID needed: detection is a ping/pong handshake.

export type ExtTokens = { slackToken?: string; slackCookie?: string; notionCookie?: string };

// Chrome Web Store listing — set after publishing so the install button can link to it.
export const WEBSTORE_URL = "https://chromewebstore.google.com/detail/REPLACE_WITH_STORE_ID";

const TAG = "otsukare-ext";
const post = (type: string) => window.postMessage({ __src: "otsukare-page", type }, window.location.origin);
const fromExt = (e: MessageEvent, type: string) =>
  e.source === window && e.data?.__src === TAG && e.data.type === type;

/** True if the extension's content script answers within `timeout` ms. */
export function extInstalled(timeout = 600): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    const on = (e: MessageEvent) => {
      if (fromExt(e, "pong") || fromExt(e, "ready")) finish(true);
    };
    const finish = (v: boolean) => {
      window.removeEventListener("message", on);
      clearTimeout(timer);
      resolve(v);
    };
    window.addEventListener("message", on);
    const timer = setTimeout(() => finish(false), timeout);
    post("ping");
  });
}

/** Ask the extension for whatever tokens it can read from the browser session. */
export function extGetTokens(timeout = 15000): Promise<ExtTokens> {
  return new Promise((resolve, reject) => {
    const on = (e: MessageEvent) => {
      if (!fromExt(e, "tokens")) return;
      window.removeEventListener("message", on);
      clearTimeout(timer);
      resolve(e.data.tokens ?? {});
    };
    window.addEventListener("message", on);
    const timer = setTimeout(() => {
      window.removeEventListener("message", on);
      reject(new Error("拡張機能から応答がありません（Slack にログインしたタブを開いて再試行）"));
    }, timeout);
    post("getTokens");
  });
}

/** Pure: pick the session token for the current workspace, else the first. Mirrors the extension. */
export function pickSlackToken(localConfigV2: string, pathname = ""): string {
  try {
    const teams = JSON.parse(localConfigV2).teams as Record<string, { token?: string }>;
    const id = pathname.match(/^\/client\/([A-Z0-9]+)/)?.[1];
    return (id && teams[id]?.token) || Object.values(teams)[0]?.token || "";
  } catch {
    return "";
  }
}
