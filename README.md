# otsukare

GitHub・Slack・Notion・Gmail・Outlook・カレンダーの「今日の活動」から、日報の下書きを 2 秒で生成する Web アプリ。

- トークンはこのブラウザの localStorage にだけ保存されます。日報は保存しません
- GitHub・Google・Microsoft の API はブラウザから直接呼びます。ブラウザから呼べない Slack と Notion だけ、同一オリジンの中継 API（`/api/slack`, `/api/notion`）を経由します。中継は毎回トークンを転送するだけで、何も保存・記録しません
- 出力は Markdown。編集してコピーし、Slack / Notion / メールに貼るだけ

```markdown
# 日報 2026-09-10

## やったこと
### GitHub
- owner/repo
  - feat: ○○を追加 #123 — 作成, レビュー対応, push×2
  - fix: △△ #120 — レビュー
  - [issue] □□が失敗する #119 — コメント, クローズ
### Notion
- 設計メモ
### Slack
- #dev: 5件 「デプロイ完了しました」 「#123 レビューお願いします」
- DM: 3件
### メール（送信）
- 見積のご確認 → @example.co.jp
### 会議
- 10:00–10:30 朝会
- 14:00–15:00 設計レビュー

## 明日やること
- [owner/repo] feat: ○○を追加 #123（レビュー待ち）
- 

## 困っていること
- 
```

## 接続の設定

### GitHub

[Personal access token](https://github.com/settings/tokens/new?scopes=repo&description=otsukare)（classic、`repo` スコープ）を作成して貼り付けます。
SAML SSO を使う組織のリポジトリを含めるには、トークン一覧の **Configure SSO** でその組織を認可してください。

取得するもの：今日あなたが 作成 / マージ / レビュー / コメント / push した PR・Issue・ブランチ（全リポジトリ横断）。

### Slack

Slack アプリの作成は不要です。ブラウザでログイン中のセッションを使います（[slack-mcp-server の手順](https://github.com/korotovsky/slack-mcp-server/blob/master/docs/01-authentication-setup.md)と同じ）。

1. ブラウザで Slack（`app.slack.com/client/…`）を開く
2. DevTools の **Console** で次を実行し、表示された `xoxc-…` を **セッショントークン** に貼る
   ```js
   JSON.parse(localStorage.localConfig_v2).teams[location.pathname.match(/^\/client\/([A-Z0-9]+)/)[1]].token
   ```
3. DevTools の **Application → Cookies → `d`** の値（`xoxd-…`）を **Cookie「d」** に貼る

取得するもの：今日あなたが送った投稿を、チャンネル別に件数＋冒頭 40 字 × 最大 3 件。DM は件数のみ。
ブラウザで Slack からログアウトするとトークンは無効になります。

### Notion

インテグレーションの作成は不要です。

1. ブラウザで [notion.so](https://www.notion.so/) を開く
2. DevTools の **Application → Cookies → `token_v2`** の値を貼る

取得するもの：所属する全ワークスペースで、今日あなたが最後に編集したページのタイトル。本文は取りません。

### Google（Gmail 送信済み・カレンダー）

「Google に接続」→ アカウントを選んで許可するだけ。Cloud プロジェクトの作成は不要です（デプロイ側が用意した 1 つの OAuth クライアントを共用）。
アクセストークンは約 1 時間で切れるので、切れたら再度「Google に接続」を押してください。

取得するもの：今日送信したメールの件名＋宛先ドメイン（受信は載せません）、今日参加した予定のタイトルと時間帯（辞退・終日は除外）。

### Outlook（送信済みメール・カレンダー）

「Microsoft に接続」→ サインインして許可するだけ。取得するものは Google と同じ。
会社 / 学校のテナントでは、管理者が同意しないとサインインできない場合があります（個人の outlook.com は不要）。

## デプロイ（Vercel）

1. [Vercel](https://vercel.com/new) でこのリポジトリを Import（Next.js として自動認識。設定変更は不要）
2. **Settings → Environment Variables** に以下を追加して Redeploy
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — [Google Cloud](https://console.cloud.google.com/apis/credentials) で **Gmail API** と **Google Calendar API** を有効化 → OAuth 同意画面は External・**Testing** のまま、**Test users** に利用者を追加 → **OAuth client ID**（Web application）を作成し、**Authorized JavaScript origins** に Vercel のオリジン（と `http://localhost:3000`）を追加
   - `NEXT_PUBLIC_MS_CLIENT_ID` — [Entra ID](https://entra.microsoft.com/) → **App registrations → New registration**：Supported account types は **Any Microsoft Entra ID tenant + personal Microsoft accounts**（multi-tenant）、Redirect URI は種類 **Single-page application** で Vercel のオリジン（と `http://localhost:3000`）。API permissions は Microsoft Graph の委任 `Mail.Read` `Calendars.Read`
3. `main` に push するたびに Vercel が自動デプロイ。PR ごとにプレビュー URL も出ます

未設定の変数があるソースは、画面上で「このデプロイでは未設定です」と表示されボタンが無効になります。

## 開発

```sh
npm install
cp .env.example .env.local   # 任意：Google / Microsoft のクライアント ID
npm run dev     # http://localhost:3000
npm test        # node --test（純粋ロジックのみ）
npm run build
```

## 構成

- Next.js（App Router）＋ TypeScript。依存は next / react / @azure/msal-browser（Microsoft サインインのポップアップ用）
- `lib/github.ts` `lib/slack.ts` `lib/notion.ts` `lib/google.ts` `lib/outlook.ts` … 1 ファイル＝1 ソース。`SourceResult { name, lines, tomorrow? }` を返せば `lib/report.ts` が日報に組み込みます（同名セクションは結合）
- `app/api/slack/route.ts` `app/api/notion/route.ts` … ステートレスな中継。Slack は `xoxc` トークン＋`d` Cookie、Notion は `token_v2` Cookie をそのまま転送するだけ
- 設定の保存先：localStorage `otsukare.settings`。Google / Microsoft のアクセストークンは sessionStorage（約 1 時間）

## 制約・今後

- Google の OAuth クライアントは **Testing** 公開ステータス：テストユーザー最大 100 人、リフレッシュ不可。100 人を超えて公開するには `gmail.readonly`（restricted scope）の CASA 審査が必要
- Notion は「今日あなたが**最後に**編集したページ」のみ。あなたの後に他人が編集したページは載りません
- 中継 API は誰でも叩けます（自分のトークンを持ち込むだけなので情報漏えいはありませんが、Vercel の帯域を使われる可能性はあります）
- 保留：LLM 要約、日報の保存
