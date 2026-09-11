export type Settings = { githubToken: string; slackToken: string; slackCookie: string; notionCookie: string };

const KEY = "otsukare.settings";
export const EMPTY: Settings = { githubToken: "", slackToken: "", slackCookie: "", notionCookie: "" };

export const loadSettings = (): Settings => ({
  ...EMPTY,
  ...JSON.parse(localStorage.getItem(KEY) ?? "{}"),
});

export const saveSettings = (s: Settings) => localStorage.setItem(KEY, JSON.stringify(s));

/** Short-lived OAuth access token in sessionStorage; `get()` is null once expired (re-connect). */
export const tokenStore = (key: string) => ({
  get: (): string | null => {
    const t = JSON.parse(sessionStorage.getItem(key) ?? "null");
    return t && t.exp > Date.now() ? t.value : null;
  },
  set: (value: string, exp: number) => sessionStorage.setItem(key, JSON.stringify({ value, exp })),
});
