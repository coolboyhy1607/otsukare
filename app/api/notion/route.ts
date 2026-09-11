// Stateless relay: Notion's internal API sends no CORS headers, so the browser can't call it.
// Auth is the user's own `token_v2` cookie, forwarded per request. Nothing is stored here.
const METHODS = new Set(["loadUserContent", "search"]);

export async function POST(req: Request) {
  const { cookie, method, body, userId } = await req.json().catch(() => ({}));
  if (!METHODS.has(method) || typeof cookie !== "string") return new Response(null, { status: 400 });
  const r = await fetch(`https://www.notion.so/api/v3/${method}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `token_v2=${cookie}`,
      // Cloudflare in front of notion.so 403s non-browser user agents.
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:136.0) Gecko/20100101 Firefox/136.0",
      ...(typeof userId === "string" && { "x-notion-active-user-header": userId }),
    },
    body: JSON.stringify(body ?? {}),
  });
  return new Response(r.body, { status: r.status, headers: { "content-type": r.headers.get("content-type") ?? "application/json" } });
}
