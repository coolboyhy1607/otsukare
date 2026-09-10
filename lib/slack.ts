import type { SourceResult } from "./report";

// Token goes in the form body: Slack allows CORS only for "simple" requests
// (no Authorization header, no preflight).
const call = async (method: string, params: Record<string, string>) => {
  const r = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    body: new URLSearchParams(params),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`Slack ${method}: ${j.error}`);
  return j;
};

const search = async (token: string, query: string) => {
  const matches: any[] = [];
  for (let page = 1; page <= 5; page++) {
    const j = await call("search.messages", {
      token, query, count: "100", page: String(page), sort: "timestamp", sort_dir: "asc",
    });
    matches.push(...j.messages.matches);
    if (page >= j.messages.paging.pages) break;
  }
  return matches;
};

/** Pure: my messages of the day -> "#channel: N件 「…」" lines (DMs: count only). */
export function renderSlack(matches: any[]): SourceResult {
  const groups = new Map<string, { dm: boolean; texts: string[] }>();
  for (const m of matches) {
    const dm = !!(m.channel.is_im || m.channel.is_mpim);
    const key = dm ? "DM" : `#${m.channel.name}`;
    const g = groups.get(key) ?? { dm, texts: [] };
    g.texts.push(m.text ?? "");
    groups.set(key, g);
  }
  const lines = [...groups]
    .sort(([, a], [, b]) => Number(a.dm) - Number(b.dm))
    .map(([name, g]) => {
      if (g.dm) return `- ${name}: ${g.texts.length}件`;
      const snippets = g.texts.slice(0, 3).map((t) => `「${t.replace(/\s+/g, " ").trim().slice(0, 40)}」`);
      return `- ${name}: ${g.texts.length}件 ${snippets.join(" ")}`;
    });
  return { name: "Slack", lines };
}

export async function slack(token: string, date: string): Promise<SourceResult> {
  const me = await call("auth.test", { token });
  // `on:` is evaluated in the searching user's Slack timezone.
  let matches = await search(token, `from:<@${me.user_id}> on:${date}`);
  if (!matches.length) matches = await search(token, `from:@${me.user} on:${date}`);
  return renderSlack(matches);
}
