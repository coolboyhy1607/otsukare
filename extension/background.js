// otsukare token filler — MV3 service worker.
// Reads the Slack `d` (xoxd) and Notion `token_v2` HttpOnly cookies via chrome.cookies,
// and the Slack `xoxc` token from app.slack.com's localStorage via chrome.scripting.
// Only replies to the otsukare content script; nothing is stored or sent anywhere else.
// Nothing is read until the user has agreed on consent.html (Chrome Web Store: prominent
// disclosure + affirmative consent before handling authentication data).

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

// Runs inside an app.slack.com tab: the current workspace's session token, else the first one.
function readXoxc() {
  try {
    const teams = JSON.parse(localStorage.localConfig_v2).teams;
    const id = location.pathname.match(/^\/client\/([A-Z0-9]+)/)?.[1];
    return (id && teams[id]?.token) || Object.values(teams)[0]?.token || "";
  } catch {
    return "";
  }
}

const readInTab = async (tabId) => {
  const [res] = await chrome.scripting.executeScript({ target: { tabId }, func: readXoxc });
  return res?.result ?? "";
};

// Resolve on the tab's "complete" event, but always settle (missed event / slow load) so the
// caller can proceed and its `finally` still closes the tab — never hang.
const waitComplete = (tabId, timeout = 6000) =>
  new Promise((resolve) => {
    const cleanup = () => {
      chrome.tabs.onUpdated.removeListener(done);
      clearTimeout(timer);
    };
    const done = (id, info) => {
      if (id === tabId && info.status === "complete") {
        cleanup();
        resolve();
      }
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, timeout);
    chrome.tabs.onUpdated.addListener(done);
  });

async function getXoxc() {
  const tabs = await chrome.tabs.query({});
  const open = tabs.find((t) => t.url?.includes("app.slack.com"));
  if (open) {
    const token = await readInTab(open.id);
    if (token) return token;
  }
  // No usable Slack tab: open one in the background, read localStorage, close it.
  const tab = await chrome.tabs.create({ url: "https://app.slack.com/", active: false });
  try {
    await waitComplete(tab.id);
    for (let i = 0; i < 5; i++) {
      const token = await readInTab(tab.id);
      if (token) return token;
      await new Promise((r) => setTimeout(r, 700)); // SPA writes localConfig_v2 after boot
    }
    return "";
  } finally {
    chrome.tabs.remove(tab.id);
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
