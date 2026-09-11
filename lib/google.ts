import { hhmm, type SourceResult } from "./report.ts";
import { tokenStore } from "./settings.ts";

declare global {
  interface Window { google?: any }
}

/** One shared OAuth client (consent screen in Testing; add users as test users). Set at build time. */
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
export const googleEnabled = !!CLIENT_ID;
const SCOPES =
  "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly";

const store = tokenStore("otsukare.google");
export const googleConnected = () => !!store.get();

const loadGis = () =>
  new Promise<void>((ok, ng) => {
    if (window.google?.accounts) return ok();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.onload = () => ok();
    s.onerror = () => ng(new Error("Google Identity Services の読み込みに失敗"));
    document.head.append(s);
  });

/** Implicit (token) flow: no backend, no refresh token; re-connect after ~1h. */
export async function connectGoogle() {
  await loadGis();
  const t = await new Promise<any>((ok, ng) => {
    window.google.accounts.oauth2
      .initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (r: any) => (r.error ? ng(new Error(r.error)) : ok(r)),
        error_callback: (e: any) => ng(new Error(e.type)),
      })
      .requestAccessToken();
  });
  store.set(t.access_token, Date.now() + t.expires_in * 1000);
}

const gapi = async (url: string) => {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${store.get()}` } });
  if (!r.ok) throw new Error(`Google API ${r.status}`);
  return r.json();
};

export async function google(start: Date, end: Date): Promise<SourceResult[]> {
  const sec = (d: Date) => Math.floor(d.getTime() / 1000);
  const q = encodeURIComponent(`in:sent after:${sec(start)} before:${sec(end)}`);
  const list = await gapi(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=100`);
  const msgs: any[] = await Promise.all(
    (list.messages ?? []).map((m: any) =>
      gapi(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=To`),
    ),
  );
  const mail = msgs.map((m) => {
    const h = Object.fromEntries(m.payload.headers.map((x: any) => [x.name, x.value]));
    const domains = [...new Set<string>((h.To ?? "").match(/@[\w.-]+/g) ?? [])].join(", ");
    return `- ${h.Subject || "(件名なし)"} → ${domains}`;
  });

  const ev = await gapi(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${start.toISOString()}&timeMax=${end.toISOString()}&singleEvents=true&orderBy=startTime&maxResults=50`,
  );
  const meetings = (ev.items ?? [])
    .filter((e: any) => e.start?.dateTime && !e.attendees?.some((a: any) => a.self && a.responseStatus === "declined"))
    .map((e: any) => `- ${hhmm(new Date(e.start.dateTime))}–${hhmm(new Date(e.end.dateTime))} ${e.summary ?? "(タイトルなし)"}`);

  return [{ name: "メール（送信）", lines: mail }, { name: "会議", lines: meetings }];
}
