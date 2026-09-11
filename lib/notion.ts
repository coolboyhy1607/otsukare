import type { SourceResult } from "./report";

// Via /api/notion: the internal API has no CORS. Auth is the `token_v2` cookie.
const call = async (cookie: string, method: string, body: unknown, userId?: string) => {
  const r = await fetch("/api/notion", { method: "POST", body: JSON.stringify({ cookie, method, body, userId }) });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`Notion ${method}: ${j?.debugMessage ?? r.status}`);
  return j;
};

// recordMap entries are `{ value: { value, role } }` (current) or `{ value }` (older).
const val = (e: any) => e?.value?.value ?? e?.value;
const text = (segs: any[] | undefined) => (segs ?? []).map((s) => s[0]).join("");

/** Pure: page blocks -> titles of pages whose last edit was mine and fell in [start, end). */
export function renderNotion(blocks: any[], me: string, start: Date, end: Date): SourceResult {
  // ponytail: "last edit was mine today" — a page I edited today but someone touched later is missed.
  // Upgrade path: activity log (/api/v3/getActivityLog) if that shows up as a real gap.
  const lines = blocks
    .filter((b) => b.last_edited_by_id === me && b.last_edited_time >= start.getTime() && b.last_edited_time < end.getTime())
    .map((b) => `- ${text(b.properties?.title) || "(タイトルなし)"}`);
  return { name: "Notion", lines };
}

export async function notion(cookie: string, start: Date, end: Date): Promise<SourceResult> {
  const { recordMap } = await call(cookie, "loadUserContent", {});
  const me = Object.keys(recordMap.notion_user)[0];
  const blocks = await Promise.all(
    Object.keys(recordMap.space ?? {}).map(async (spaceId) => {
      const j = await call(cookie, "search", {
        type: "BlocksInSpace", query: "", spaceId, limit: 100,
        filters: {
          isDeletedOnly: false, excludeTemplates: false, navigableBlockContentOnly: true, requireEditPermissions: false,
          ancestors: [], createdBy: [], editedBy: [me], lastEditedTime: {}, createdTime: {},
        },
        sort: { field: "lastEdited", direction: "desc" },
        source: "quick_find_filters",
      }, me);
      return (j.results ?? []).map((r: any) => val(j.recordMap?.block?.[r.id])).filter(Boolean);
    }),
  );
  return renderNotion(blocks.flat(), me, start, end);
}
