export type Settings = { githubToken: string; slackToken: string; googleClientId: string };

const KEY = "otsukare.settings";
const EMPTY: Settings = { githubToken: "", slackToken: "", googleClientId: "" };

export const loadSettings = (): Settings => ({
  ...EMPTY,
  ...JSON.parse(localStorage.getItem(KEY) ?? "{}"),
});

export const saveSettings = (s: Settings) => localStorage.setItem(KEY, JSON.stringify(s));
