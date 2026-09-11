"use client";

import { useEffect, useState } from "react";
import { github } from "@/lib/github";
import { connectGoogle, google, googleConnected, googleEnabled } from "@/lib/google";
import { notion } from "@/lib/notion";
import { connectOutlook, outlook, outlookConnected, outlookEnabled } from "@/lib/outlook";
import { dayRange, render, today, type SourceResult } from "@/lib/report";
import { EMPTY, loadSettings, saveSettings, type Settings } from "@/lib/settings";
import { extGetTokens, extStatus, type ExtStatus, type ExtTokens, WEBSTORE_URL } from "@/lib/extension";
import { slack } from "@/lib/slack";

// Solid button colour for the extension status (amber = install, blue = consent, green = ready).
const tint = (c: string) => ({ background: c, color: "#fff", borderColor: c });

export default function Page() {
  const [s, setS] = useState<Settings>(EMPTY);
  const [date, setDate] = useState("");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [gOk, setGOk] = useState(false);
  const [oOk, setOOk] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ext, setExt] = useState<"checking" | ExtStatus>("checking");
  const [extBusy, setExtBusy] = useState(false);
  const [extNote, setExtNote] = useState("");

  const update = (patch: Partial<Settings>) => {
    setS((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  };

  // Fill only the fields the extension could actually read (keeps existing values otherwise).
  const applyTokens = (t: ExtTokens) => {
    const patch: Partial<Settings> = {};
    if (t.slackToken) patch.slackToken = t.slackToken;
    if (t.slackCookie) patch.slackCookie = t.slackCookie;
    if (t.notionCookie) patch.notionCookie = t.notionCookie;
    update(patch);
    return Object.keys(patch).length;
  };

  const autofill = async () => {
    setExtBusy(true);
    setExtNote("");
    try {
      const t = await extGetTokens();
      if (t.error === "consent") {
        // The extension has opened its consent page; the user comes back here after agreeing.
        setExt("consent");
        setExtNote("拡張機能の同意画面を開きました。「同意する」を押すと otsukare に戻り、自動入力できます。");
        return;
      }
      setExt("yes");
      const got = [t.slackToken && "xoxc", t.slackCookie && "xoxd", t.notionCookie && "token_v2"].filter(Boolean);
      applyTokens(t);
      setExtNote(got.length ? `自動入力しました：${got.join(" / ")}` : "読み取れるトークンがありません（Slack / Notion にログイン中のタブがあるか確認）");
    } catch (e) {
      setExtNote(e instanceof Error ? e.message : String(e));
    } finally {
      setExtBusy(false);
    }
  };

  useEffect(() => {
    const loaded = loadSettings();
    setS(loaded);
    setDate(today());
    setGOk(googleConnected());
    setOOk(outlookConnected());
    extStatus().then((st) => {
      setExt(st);
      const complete = loaded.slackToken && loaded.slackCookie && loaded.notionCookie;
      if (st === "yes" && !complete) autofill(); // only after the user agreed on the consent page
    });
  }, []);

  const connect = (name: string, fn: () => Promise<void>, done: (ok: boolean) => void) => async () => {
    try {
      await fn();
      done(true);
      setErrors((e) => ({ ...e, [name]: "" }));
    } catch (e) {
      setErrors((x) => ({ ...x, [name]: String(e) }));
    }
  };

  const run = async () => {
    setBusy(true);
    const { start, end } = dayRange(date);
    const results: SourceResult[] = [];
    const errs: Record<string, string> = {};
    const track = (name: string, p: Promise<SourceResult | SourceResult[]>) =>
      p.then((r) => results.push(...[r].flat()), (e) => (errs[name] = String(e)));
    const slackOk = s.slackToken && s.slackCookie;
    const tasks = [
      s.githubToken && track("GitHub", github(s.githubToken.trim(), start, end)),
      slackOk && track("Slack", slack({ token: s.slackToken.trim(), cookie: s.slackCookie.trim() }, date)),
      s.notionCookie && track("Notion", notion(s.notionCookie.trim(), start, end)),
      googleConnected() && track("Google", google(start, end)),
      outlookConnected() && track("Outlook", outlook(start, end)),
    ].filter(Boolean);
    await Promise.all(tasks);
    setOut(render(date, results));
    setErrors(errs);
    setGOk(googleConnected());
    setOOk(outlookConnected());
    setBusy(false);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(out);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const anySource = !!(s.githubToken || (s.slackToken && s.slackCookie) || s.notionCookie || gOk || oOk);

  return (
    <main>
      <h1>otsukare</h1>
      <p>GitHub・Slack・Notion・メール・カレンダーの今日の活動から、日報の下書きを2秒で。トークンはこのブラウザにだけ保存されます。</p>

      <div className="row">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ flex: "none" }} />
        <button className="primary" onClick={run} disabled={busy || !date || !anySource}>
          {busy ? "生成中…" : "日報を生成"}
        </button>
        {out && <button onClick={copy}>{copied ? "コピーしました" : "コピー"}</button>}
      </div>
      {!anySource && <p className="hint">下の「接続」でソースを1つ以上設定してください。</p>}
      {Object.entries(errors).filter(([, v]) => v).map(([k, v]) => (
        <p key={k} className="err">{k}: {v}</p>
      ))}
      {out && <textarea value={out} onChange={(e) => setOut(e.target.value)} spellCheck={false} />}

      <h2>接続</h2>

      <div className="card">
        <div className="row">
          <label>Slack・Notion を自動入力</label>
          {ext === "yes" && <small className="ok">拡張機能あり・同意済み</small>}
          {ext === "consent" && <small className="hint">拡張機能あり・未同意</small>}
          {ext === "no" && <small className="hint">拡張機能なし</small>}
        </div>
        <div className="row">
          {ext === "no" ? (
            <button style={tint("#d90")} onClick={() => window.open(WEBSTORE_URL, "_blank", "noreferrer")}>
              拡張機能をインストール
            </button>
          ) : (
            <button style={ext === "yes" ? tint("#2a7") : ext === "consent" ? tint("#27b") : undefined}
              onClick={autofill} disabled={ext === "checking" || extBusy}>
              {ext === "checking" ? "確認中…" : extBusy ? "取得中…" : ext === "consent" ? "同意して自動入力" : "ブラウザから自動入力"}
            </button>
          )}
        </div>
        <small className={extNote.startsWith("自動入力") ? "ok" : "hint"}>
          {extNote ||
            (ext === "no"
              ? "拡張機能を入れると、Slack の xoxc/xoxd と Notion の token_v2 をログイン中のブラウザから自動で読み取って入力します。インストール後は同意画面を経てこの画面に戻ります。"
              : ext === "consent"
                ? "拡張機能はまだ何も読み取っていません。ボタンを押すと同意画面が開き、「同意する」で自動入力が有効になります。"
                : "ログイン中の Slack / Notion のセッションから読み取ります。トークンはこのブラウザの外に出ません。同意は拡張機能のアイコンからいつでも取り消せます。")}
        </small>
      </div>

      <div className="card">
        <div className="row">
          <label>GitHub</label>
          {s.githubToken && <small className="ok">設定済み</small>}
        </div>
        <div className="row">
          <input type="password" placeholder="Personal access token（repo スコープ）" value={s.githubToken}
            onChange={(e) => update({ githubToken: e.target.value })} autoComplete="off" />
        </div>
        <small className="hint">
          <a href="https://github.com/settings/tokens/new?scopes=repo&description=otsukare" target="_blank" rel="noreferrer">トークンを作成</a>
          （SSO を使う組織では、作成後にトークンの Configure SSO で組織を認可）
        </small>
      </div>

      <div className="card">
        <div className="row">
          <label>Slack</label>
          {s.slackToken && s.slackCookie && <small className="ok">設定済み</small>}
        </div>
        <div className="row">
          <input type="password" placeholder="xoxc-…（セッショントークン）" value={s.slackToken}
            onChange={(e) => update({ slackToken: e.target.value })} autoComplete="off" />
          <input type="password" placeholder="xoxd-…（Cookie「d」の値）" value={s.slackCookie}
            onChange={(e) => update({ slackCookie: e.target.value })} autoComplete="off" />
        </div>
        <small className="hint">
          上の「自動入力」が使えない場合の手動手順：アプリ作成は不要。ブラウザで Slack を開き、DevTools の Console で
          <code>JSON.parse(localStorage.localConfig_v2).teams[location.pathname.match(/^\/client\/([A-Z0-9]+)/)[1]].token</code>
          → xoxc。Application → Cookies → <code>d</code> の値 → xoxd。手順は <a href="https://github.com/coolboyhy1607/otsukare#slack" target="_blank" rel="noreferrer">README</a>。
        </small>
      </div>

      <div className="card">
        <div className="row">
          <label>Notion</label>
          {s.notionCookie && <small className="ok">設定済み</small>}
        </div>
        <div className="row">
          <input type="password" placeholder="Cookie「token_v2」の値" value={s.notionCookie}
            onChange={(e) => update({ notionCookie: e.target.value })} autoComplete="off" />
        </div>
        <small className="hint">
          上の「自動入力」が使えない場合の手動手順：インテグレーション作成は不要。notion.so を開き、DevTools → Application → Cookies → <code>token_v2</code> の値をコピー。
          取得するのは、今日あなたが最後に編集したページのタイトルのみ。
        </small>
      </div>

      <div className="card">
        <div className="row">
          <label>Google（Gmail 送信済み・カレンダー）</label>
          {gOk && <small className="ok">接続中（約1時間有効）</small>}
        </div>
        <div className="row">
          <button onClick={connect("Google", connectGoogle, setGOk)} disabled={!googleEnabled}>Google に接続</button>
        </div>
        <small className="hint">
          {googleEnabled
            ? "「Google に接続」→ アカウントを選んで許可するだけ。読み取り専用（gmail.readonly / calendar.readonly）。"
            : "このデプロイでは未設定です（NEXT_PUBLIC_GOOGLE_CLIENT_ID）。"}
        </small>
      </div>

      <div className="card">
        <div className="row">
          <label>Outlook（送信済みメール・カレンダー）</label>
          {oOk && <small className="ok">接続中（約1時間有効）</small>}
        </div>
        <div className="row">
          <button onClick={connect("Outlook", connectOutlook, setOOk)} disabled={!outlookEnabled}>Microsoft に接続</button>
        </div>
        <small className="hint">
          {outlookEnabled
            ? "「Microsoft に接続」→ サインインして許可するだけ。読み取り専用（Mail.Read / Calendars.Read）。会社テナントでは管理者の同意が必要な場合があります。"
            : "このデプロイでは未設定です（NEXT_PUBLIC_MS_CLIENT_ID）。"}
        </small>
      </div>

      <p className="hint" style={{ marginTop: 28 }}>
        トークンはこのブラウザの localStorage にだけ保存されます。GitHub・Google・Microsoft は各 API を直接呼び、
        ブラウザから呼べない Slack・Notion だけ同一オリジンの中継 API（何も保存しません）を経由します。
      </p>
    </main>
  );
}
