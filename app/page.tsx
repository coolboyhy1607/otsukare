"use client";

import { useEffect, useState } from "react";
import { github } from "@/lib/github";
import { connectGoogle, google, googleConnected } from "@/lib/google";
import { dayRange, render, today, type SourceResult } from "@/lib/report";
import { loadSettings, saveSettings, type Settings } from "@/lib/settings";
import { slack } from "@/lib/slack";

const EMPTY: Settings = { githubToken: "", slackToken: "", googleClientId: "" };

export default function Page() {
  const [s, setS] = useState<Settings>(EMPTY);
  const [date, setDate] = useState("");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [gOk, setGOk] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setS(loadSettings());
    setDate(today());
    setGOk(googleConnected());
  }, []);

  const update = (patch: Partial<Settings>) => {
    const next = { ...s, ...patch };
    setS(next);
    saveSettings(next);
  };

  const connect = async () => {
    try {
      await connectGoogle(s.googleClientId.trim());
      setGOk(true);
      setErrors((e) => ({ ...e, Google: "" }));
    } catch (e) {
      setErrors((x) => ({ ...x, Google: String(e) }));
    }
  };

  const run = async () => {
    setBusy(true);
    const { start, end } = dayRange(date);
    const results: SourceResult[] = [];
    const errs: Record<string, string> = {};
    const track = (name: string, p: Promise<SourceResult | SourceResult[]>) =>
      p.then((r) => results.push(...[r].flat()), (e) => (errs[name] = String(e)));
    const tasks = [
      s.githubToken && track("GitHub", github(s.githubToken.trim(), start, end)),
      s.slackToken && track("Slack", slack(s.slackToken.trim(), date)),
      googleConnected() && track("Google", google(start, end)),
    ].filter(Boolean);
    await Promise.all(tasks);
    setOut(render(date, results));
    setErrors(errs);
    setGOk(googleConnected());
    setBusy(false);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(out);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const anySource = !!(s.githubToken || s.slackToken || gOk);

  return (
    <main>
      <h1>otsukare</h1>
      <p>GitHub・Slack・Gmail・カレンダーの今日の活動から、日報の下書きを2秒で。データはブラウザの外に出ません。</p>

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
          {s.slackToken && <small className="ok">設定済み</small>}
        </div>
        <div className="row">
          <input type="password" placeholder="User OAuth Token（xoxp-…、search:read）" value={s.slackToken}
            onChange={(e) => update({ slackToken: e.target.value })} autoComplete="off" />
        </div>
        <small className="hint">
          <a href="https://api.slack.com/apps?new_app=1" target="_blank" rel="noreferrer">Slack アプリを作成</a>
          → OAuth &amp; Permissions → User Token Scopes に <code>search:read</code> → Install to Workspace → User OAuth Token をコピー
        </small>
      </div>

      <div className="card">
        <div className="row">
          <label>Google（Gmail 送信済み・カレンダー）</label>
          {gOk ? <small className="ok">接続中（約1時間有効）</small> : s.googleClientId && <small>未接続</small>}
        </div>
        <div className="row">
          <input placeholder="OAuth クライアント ID（…apps.googleusercontent.com）" value={s.googleClientId}
            onChange={(e) => update({ googleClientId: e.target.value })} autoComplete="off" />
          <button onClick={connect} disabled={!s.googleClientId}>Google に接続</button>
        </div>
        <small className="hint">
          <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">Google Cloud</a>
          で Gmail API と Calendar API を有効化 → OAuth クライアント ID（ウェブ アプリケーション）を作成し、承認済み JavaScript 生成元に
          このサイトのオリジンを追加。手順は <a href="https://github.com/coolboyhy1607/otsukare#google" target="_blank" rel="noreferrer">README</a>。
        </small>
      </div>

      <p className="hint" style={{ marginTop: 28 }}>
        トークンはこのブラウザの localStorage にだけ保存され、各サービスの API へ直接送られます。サーバーはありません。
      </p>
    </main>
  );
}
