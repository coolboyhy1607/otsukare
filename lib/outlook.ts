import { hhmm, type SourceResult } from "./report.ts";
import { tokenStore } from "./settings.ts";

/** One shared multi-tenant app registration (SPA redirect URI = this origin). Set at build time. */
const CLIENT_ID = process.env.NEXT_PUBLIC_MS_CLIENT_ID ?? "";
export const outlookEnabled = !!CLIENT_ID;
const SCOPES = ["Mail.Read", "Calendars.Read"];

const store = tokenStore("otsukare.outlook");
export const outlookConnected = () => !!store.get();

/** Popup flow via MSAL; like Google we keep only the ~1h access token and re-connect when it expires. */
export async function connectOutlook() {
  const { PublicClientApplication } = await import("@azure/msal-browser");
  const pca = new PublicClientApplication({
    auth: { clientId: CLIENT_ID, authority: "https://login.microsoftonline.com/common", redirectUri: location.origin },
  });
  await pca.initialize();
  const r = await pca.loginPopup({ scopes: SCOPES });
  store.set(r.accessToken, r.expiresOn?.getTime() ?? Date.now() + 3_600_000);
}

const graph = async (path: string) => {
  const r = await fetch(`https://graph.microsoft.com/v1.0/me${path}`, { headers: { Authorization: `Bearer ${store.get()}` } });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`Graph API ${r.status}: ${j?.error?.message ?? ""}`);
  return j;
};

// Graph returns 7 fractional digits ("…T01:00:00.0000000") in UTC; trim to what Date parses everywhere.
const utc = (t: { dateTime: string }) => new Date(`${t.dateTime.slice(0, 19)}Z`);

/** Pure: sent messages + calendarView events -> same lines as Gmail / Google Calendar. */
export function renderOutlook(messages: any[], events: any[]): SourceResult[] {
  const mail = messages.map((m) => {
    const domains = [...new Set<string>((m.toRecipients ?? []).map((r: any) => r.emailAddress.address.replace(/^[^@]*/, "")))].join(", ");
    return `- ${m.subject || "(件名なし)"} → ${domains}`;
  });
  const meetings = events
    .filter((e) => !e.isAllDay && !e.isCancelled && e.responseStatus?.response !== "declined")
    .map((e) => `- ${hhmm(utc(e.start))}–${hhmm(utc(e.end))} ${e.subject || "(タイトルなし)"}`);
  return [{ name: "メール（送信）", lines: mail }, { name: "会議", lines: meetings }];
}

export async function outlook(start: Date, end: Date): Promise<SourceResult[]> {
  const filter = encodeURIComponent(`sentDateTime ge ${start.toISOString()} and sentDateTime lt ${end.toISOString()}`);
  const [sent, cal] = await Promise.all([
    graph(`/mailFolders/sentitems/messages?$filter=${filter}&$select=subject,toRecipients&$top=100`),
    graph(`/calendarView?startDateTime=${start.toISOString()}&endDateTime=${end.toISOString()}&$select=subject,start,end,isAllDay,isCancelled,responseStatus&$orderby=start/dateTime&$top=50`),
  ]);
  return renderOutlook(sent.value ?? [], cal.value ?? []);
}
