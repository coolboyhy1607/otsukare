import assert from "node:assert/strict";
import { test } from "node:test";
import { reduceEvents, renderGithub } from "./github.ts";
import { pickSlackToken } from "./extension.ts";
import { renderNotion } from "./notion.ts";
import { renderOutlook } from "./outlook.ts";
import { dayRange, render } from "./report.ts";
import { renderSlack } from "./slack.ts";

const ev = (type: string, repo: string, payload: any) => ({ type, repo: { name: repo }, created_at: "", payload });

test("events -> grouped items, own-PR review becomes レビュー対応, push folds into PR", () => {
  const { items, pushes } = reduceEvents([
    ev("PullRequestEvent", "o/r", { action: "opened", number: 1 }),
    ev("PullRequestReviewCommentEvent", "o/r", { pull_request: { number: 1 } }),
    ev("PullRequestReviewEvent", "o/r", { pull_request: { number: 2 } }),
    ev("IssueCommentEvent", "o/r", { issue: { number: 3, title: "bug" } }),
    ev("IssuesEvent", "o/r", { action: "closed", issue: { number: 3, title: "bug" } }),
    ev("PushEvent", "o/r", { ref: "refs/heads/feat" }),
    ev("PushEvent", "o/r", { ref: "refs/heads/feat" }),
    ev("PushEvent", "o/x", { ref: "refs/heads/main" }),
  ]);
  assert.equal(items.length, 3);
  assert.equal(pushes.get("o/r@feat"), 2);

  // simulate PR resolution
  Object.assign(items[0], { title: "My PR", mine: true, branch: "feat", acts: new Set([...items[0].acts, "push×2"]) });
  pushes.delete("o/r@feat");
  Object.assign(items[1], { title: "Their PR", mine: false });

  const { lines, tomorrow } = renderGithub(items, pushes);
  assert.deepEqual(lines, [
    "- o/r",
    "  - My PR #1 — 作成, レビュー対応, push×2",
    "  - Their PR #2 — レビュー",
    "  - [issue] bug #3 — コメント, クローズ",
    "- o/x",
    "  - `main` — push×1",
  ]);
  assert.deepEqual(tomorrow, ["- [o/r] My PR #1（レビュー待ち）"]);
});

test("slack: channels get snippets, DMs count only, DMs last", () => {
  const { lines } = renderSlack([
    { channel: { name: "d", is_im: true }, text: "secret" },
    { channel: { name: "dev" }, text: "hello\n  world" },
    { channel: { name: "dev" }, text: "x".repeat(60) },
  ]);
  assert.deepEqual(lines, [`- #dev: 2件 「hello world」 「${"x".repeat(40)}」`, "- DM: 1件"]);
});

test("notion: only pages last edited by me within the day, title segments joined", () => {
  const { start, end } = dayRange("2026-09-10");
  const t = start.getTime();
  const { lines } = renderNotion(
    [
      { last_edited_by_id: "me", last_edited_time: t + 1000, properties: { title: [["設計", ["b"]], ["メモ"]] } },
      { last_edited_by_id: "me", last_edited_time: t + 1000, properties: {} },
      { last_edited_by_id: "you", last_edited_time: t + 1000, properties: { title: [["theirs"]] } },
      { last_edited_by_id: "me", last_edited_time: end.getTime(), properties: { title: [["tomorrow"]] } },
      { last_edited_by_id: "me", last_edited_time: t - 1, properties: { title: [["yesterday"]] } },
    ],
    "me", start, end,
  );
  assert.deepEqual(lines, ["- 設計メモ", "- (タイトルなし)"]);
});

test("outlook: recipient domains deduped, all-day / declined / cancelled events dropped", () => {
  const [mail, meetings] = renderOutlook(
    [{ subject: "見積", toRecipients: [{ emailAddress: { address: "a@x.jp" } }, { emailAddress: { address: "b@x.jp" } }, { emailAddress: { address: "c@y.com" } }] },
     { subject: "" }],
    [
      { subject: "朝会", isAllDay: false, start: { dateTime: "2026-09-10T01:00:00.0000000" }, end: { dateTime: "2026-09-10T01:30:00.0000000" } },
      { subject: "休暇", isAllDay: true, start: { dateTime: "2026-09-10T00:00:00.0000000" }, end: { dateTime: "2026-09-11T00:00:00.0000000" } },
      { subject: "辞退", isAllDay: false, responseStatus: { response: "declined" }, start: { dateTime: "2026-09-10T02:00:00.0000000" }, end: { dateTime: "2026-09-10T03:00:00.0000000" } },
      { subject: "中止", isAllDay: false, isCancelled: true, start: { dateTime: "2026-09-10T04:00:00.0000000" }, end: { dateTime: "2026-09-10T05:00:00.0000000" } },
    ],
  );
  assert.deepEqual(mail.lines, ["- 見積 → @x.jp, @y.com", "- (件名なし) → "]);
  assert.equal(meetings.lines.length, 1);
  assert.match(meetings.lines[0], /^- \d\d:\d\d–\d\d:\d\d 朝会$/);
});

test("pickSlackToken: current workspace from path, else first team, else empty on garbage", () => {
  const cfg = JSON.stringify({ teams: { T1: { token: "xoxc-1" }, T2: { token: "xoxc-2" } } });
  assert.equal(pickSlackToken(cfg, "/client/T2/C123"), "xoxc-2");
  assert.equal(pickSlackToken(cfg, "/client/UNKNOWN"), "xoxc-1"); // path team missing -> first
  assert.equal(pickSlackToken(cfg, ""), "xoxc-1");
  assert.equal(pickSlackToken("not json", "/client/T2"), "");
});

test("report: fixed section order, empty sources omitted, same-named sections merged", () => {
  const md = render("2026-09-10", [
    { name: "会議", lines: ["- 10:00–10:30 朝会"] },
    { name: "Slack", lines: [] },
    { name: "GitHub", lines: ["- o/r", "  - PR #1 — 作成"], tomorrow: ["- [o/r] PR #1（レビュー待ち）"] },
    { name: "会議", lines: ["- 14:00–15:00 設計レビュー"] },
  ]);
  assert.equal(
    md,
    [
      "# 日報 2026-09-10", "", "## やったこと",
      "### GitHub", "- o/r", "  - PR #1 — 作成",
      "### 会議", "- 10:00–10:30 朝会", "- 14:00–15:00 設計レビュー",
      "", "## 明日やること", "- [o/r] PR #1（レビュー待ち）", "- ", "", "## 困っていること", "- ",
    ].join("\n"),
  );
});
