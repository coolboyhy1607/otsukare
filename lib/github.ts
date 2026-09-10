import type { SourceResult } from "./report";

export type Event = {
  type: string;
  created_at: string;
  repo: { name: string };
  // Payloads of private-repo events are trimmed by GitHub (no titles, no commits).
  payload: any;
};

export type Item = {
  repo: string;
  number: number;
  isPR: boolean;
  title?: string;
  acts: Set<string>;
  mine?: boolean;
  merged?: boolean;
  draft?: boolean;
  branch?: string;
};

/** Pure: events of one day -> items I touched + pushes per "repo@branch". */
export function reduceEvents(events: Event[]) {
  const items = new Map<string, Item>();
  const pushes = new Map<string, number>();
  const touch = (repo: string, number: number, isPR: boolean, act: string, title?: string) => {
    const k = `${repo}#${number}`;
    const it = items.get(k) ?? { repo, number, isPR, acts: new Set<string>(), title };
    it.acts.add(act);
    it.title ??= title;
    items.set(k, it);
  };
  for (const e of events) {
    const repo = e.repo.name;
    const p = e.payload;
    switch (e.type) {
      case "PullRequestEvent":
        if (p.action === "opened") touch(repo, p.number, true, "作成");
        else if (p.action === "closed") touch(repo, p.number, true, "クローズ");
        else if (p.action === "ready_for_review") touch(repo, p.number, true, "レビュー依頼");
        break;
      case "PullRequestReviewEvent":
      case "PullRequestReviewCommentEvent":
        touch(repo, p.pull_request.number, true, "レビュー");
        break;
      case "IssueCommentEvent":
        touch(repo, p.issue.number, !!p.issue.pull_request, "コメント", p.issue.title);
        break;
      case "IssuesEvent":
        if (p.action === "opened") touch(repo, p.issue.number, false, "作成", p.issue.title);
        else if (p.action === "closed") touch(repo, p.issue.number, false, "クローズ", p.issue.title);
        break;
      case "PushEvent": {
        const k = `${repo}@${p.ref.replace("refs/heads/", "")}`;
        pushes.set(k, (pushes.get(k) ?? 0) + 1);
      }
    }
  }
  return { items: [...items.values()], pushes };
}

/** Pure: items (PR details resolved) + leftover pushes -> markdown lines. */
export function renderGithub(items: Item[], pushes: Map<string, number>): SourceResult {
  const byRepo = new Map<string, string[]>();
  const add = (repo: string, line: string) =>
    (byRepo.get(repo) ?? byRepo.set(repo, []).get(repo)!).push(line);
  for (const it of items) {
    const acts = [...it.acts].map((a) => (a === "レビュー" && it.mine ? "レビュー対応" : a));
    add(it.repo, `  - ${it.isPR ? "" : "[issue] "}${it.title} #${it.number} — ${acts.join(", ")}`);
  }
  for (const [k, n] of pushes) {
    const [repo, branch] = k.split("@");
    add(repo, `  - \`${branch}\` — push×${n}`);
  }
  const lines = [...byRepo].flatMap(([repo, ls]) => [`- ${repo}`, ...ls]);
  const tomorrow = items
    .filter((i) => i.isPR && i.mine && !i.merged && !i.acts.has("クローズ"))
    .map((i) => `- [${i.repo}] ${i.title} #${i.number}${i.draft ? "（draft）" : "（レビュー待ち）"}`);
  return { name: "GitHub", lines, tomorrow };
}

const api = async <T>(path: string, token: string): Promise<T> => {
  const r = await fetch(`https://api.github.com${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });
  if (!r.ok) throw new Error(`GitHub API ${r.status} (${path})`);
  return r.json();
};

export async function github(token: string, start: Date, end: Date): Promise<SourceResult> {
  const { login } = await api<{ login: string }>("/user", token);
  const events: Event[] = [];
  for (let page = 1; page <= 3; page++) {
    const batch = await api<Event[]>(`/users/${login}/events?per_page=100&page=${page}`, token);
    events.push(...batch);
    if (batch.length < 100 || new Date(batch.at(-1)!.created_at) < start) break;
  }
  const todays = events.filter((e) => {
    const t = new Date(e.created_at);
    return t >= start && t < end;
  });
  const { items, pushes } = reduceEvents(todays);
  await Promise.all(
    items.filter((i) => i.isPR).map(async (it) => {
      const pr = await api<any>(`/repos/${it.repo}/pulls/${it.number}`, token);
      it.title = pr.title;
      it.mine = pr.user.login === login;
      it.merged = !!pr.merged_at;
      it.draft = pr.draft;
      it.branch = pr.head.ref;
      if (it.acts.has("クローズ") && it.merged) {
        it.acts.delete("クローズ");
        it.acts.add("マージ");
      }
      const n = pushes.get(`${it.repo}@${it.branch}`);
      if (n) {
        it.acts.add(`push×${n}`);
        pushes.delete(`${it.repo}@${it.branch}`);
      }
    }),
  );
  return renderGithub(items, pushes);
}
