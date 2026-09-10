import assert from "node:assert/strict";
import { test } from "node:test";
import { reduceEvents, renderGithub } from "./github.ts";
import { render } from "./report.ts";
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

test("report: fixed section order, empty sources omitted", () => {
  const md = render("2026-09-10", [
    { name: "会議", lines: ["- 10:00–10:30 朝会"] },
    { name: "Slack", lines: [] },
    { name: "GitHub", lines: ["- o/r", "  - PR #1 — 作成"], tomorrow: ["- [o/r] PR #1（レビュー待ち）"] },
  ]);
  assert.equal(
    md,
    [
      "# 日報 2026-09-10", "", "## やったこと",
      "### GitHub", "- o/r", "  - PR #1 — 作成",
      "### 会議", "- 10:00–10:30 朝会",
      "", "## 明日やること", "- [o/r] PR #1（レビュー待ち）", "- ", "", "## 困っていること", "- ",
    ].join("\n"),
  );
});
