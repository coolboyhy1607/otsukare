// Stateless relay: browsers can't send a Cookie header to slack.com, and xoxc session
// tokens are only valid together with the `d` (xoxd) cookie. Nothing is stored here.
export async function POST(req: Request) {
  const { token, cookie, method, params } = await req.json();
  if (!/^[\w.]+$/.test(method)) return new Response(null, { status: 400 });
  const r = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Cookie: `d=${cookie}` },
    body: new URLSearchParams(params),
  });
  return new Response(r.body, { status: r.status, headers: { "content-type": r.headers.get("content-type") ?? "application/json" } });
}
