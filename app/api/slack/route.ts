// Stateless relay: browsers can't send a Cookie header to slack.com, and xoxc session
// tokens are only valid together with the `d` (xoxd) cookie. Nothing is stored here.
// Request shape mirrors slackdump / slack-mcp-server: token as a form field, `d` + `d-s` cookies, browser UA.
const METHODS = new Set(["auth.test", "search.messages"]);
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function POST(req: Request) {
  const { token, cookie, method, params } = await req.json().catch(() => ({}));
  if (!METHODS.has(method) || typeof token !== "string" || typeof cookie !== "string") return new Response(null, { status: 400 });
  // DevTools shows `d` percent-encoded; if someone pastes the decoded form, re-encode it (as slackdump does).
  const d = /^[\w%.~-]+$/.test(cookie) ? cookie : encodeURIComponent(cookie);
  const r = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: `d=${d}; d-s=${Math.floor(Date.now() / 1000) - 10}`,
      "user-agent": UA,
    },
    body: new URLSearchParams({ ...params, token }).toString(),
  });
  return new Response(r.body, { status: r.status, headers: { "content-type": r.headers.get("content-type") ?? "application/json" } });
}
