// otsukare Autofill — MV3 service worker.
// Reads the Slack `d` (xoxd) and Notion `token_v2` HttpOnly cookies via chrome.cookies,
// and captures the Slack `xoxc` token from a Slack API request via chrome.webRequest.
// Only replies to the otsukare content script; nothing is stored or sent anywhere else.
// Nothing is read until the user has agreed on consent.html (Chrome Web Store: prominent
// disclosure + affirmative consent before handling authentication data).
//
// Why webRequest and not localStorage: since Slack's 2026-01 change, `localConfig_v2` holds
// `"teams":{}` and the xoxc token is no longer stored on disk. The only place it still appears
// is the `token` field of the web client's own API calls, so we capture it there.

// Where to send the user after they agree (so they land back on otsukare and it auto-fills).
// MUST match a host in manifest.json's content_scripts. Change to your real public otsukare origin.
// NOTE: the short alias `otsukare.vercel.app` is owned by someone else — do NOT use it.
const WEB_URL = "https://otsukare-six.vercel.app/";
const CONSENT_URL = chrome.runtime.getURL("consent.html");

const consented = async () => (await chrome.storage.local.get("consent")).consent === true;

// No consent yet: show the disclosure page and tell the caller why there are no tokens.
const askConsent = async () => {
  await chrome.tabs.create({ url: CONSENT_URL });
  return { error: "consent" };
};

const cookie = async (url, name) => (await chrome.cookies.get({ url, name }))?.value ?? "";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Latest xoxc seen on a Slack API request. Registered at top level so it re-attaches on every
// service-worker wake and is live while a Slack tab boots. Never sent anywhere but the page.
let captured = "";
const pickXoxc = (details) => {
  try {
    const q = new URL(details.url).searchParams.get("token");
    if (q?.startsWith("xoxc-")) return q;
  } catch {}
  const fd = details.requestBody?.formData?.token?.[0];
  if (typeof fd === "string" && fd.startsWith("xoxc-")) return fd;
  const raw = details.requestBody?.raw?.[0]?.bytes;
  if (raw) return new TextDecoder().decode(raw).match(/xoxc-[0-9A-Za-z-]+/)?.[0] ?? "";
  return "";
};
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const t = pickXoxc(details);
    if (t) captured = t;
  },
  { urls: ["*://*.slack.com/*"] },
  ["requestBody"],
);

// xoxc rotates (sometimes hourly), so capture a fresh one each time rather than cache a stale one:
// open a background app.slack.com tab, let its boot call fire (carrying the token), read, close.
async function getXoxc() {
  captured = "";
  const tab = await chrome.tabs.create({ url: "https://app.slack.com/", active: false });
  try {
    for (let i = 0; i < 24 && !captured; i++) await sleep(500); // ~12s for client.boot to fire
    return captured;
  } finally {
    chrome.tabs.remove(tab.id).catch(() => {});
  }
}

async function getTokens() {
  const [slackCookie, notionCookie, slackToken] = await Promise.all([
    cookie("https://slack.com", "d"),
    cookie("https://www.notion.so", "token_v2"),
    getXoxc().catch(() => ""),
  ]);
  return { slackToken, slackCookie, notionCookie };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "getTokens") {
    consented()
      .then((ok) => (ok ? getTokens() : askConsent()))
      .then(sendResponse, () => sendResponse({}));
    return true; // async response
  }
  // consent.html → go to otsukare in the same tab (single place that knows WEB_URL).
  if (msg?.type === "openWeb") {
    if (sender.tab) chrome.tabs.update(sender.tab.id, { url: WEB_URL });
    else chrome.tabs.create({ url: WEB_URL });
  }
});

// Install → disclosure first; "同意する" there opens otsukare. Toolbar icon → same page (revoke).
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") chrome.tabs.create({ url: CONSENT_URL });
});
chrome.action.onClicked.addListener(() => chrome.tabs.create({ url: CONSENT_URL }));
