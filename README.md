# otsukare

GitHub・Slack・Gmail・Google カレンダーの「今日の活動」から、日報の下書きを 2 秒で生成する Web アプリ。

**https://coolboyhy1607.github.io/otsukare/**

- サーバーなし。ブラウザから各サービスの API を直接呼びます。トークンはこのブラウザの localStorage にだけ保存されます
- 出力は Markdown。編集してコピーし、Slack / Notion / メールに貼るだけ
- 生成した日報は保存しません

```markdown
# 日報 2026-09-10

## やったこと
### GitHub
- owner/repo
  - feat: ○○を追加 #123 — 作成, レビュー対応, push×2
  - fix: △△ #120 — レビュー
  - [issue] □□が失敗する #119 — コメント, クローズ
### Slack
- #dev: 5件 「デプロイ完了しました」 「#123 レビューお願いします」
- DM: 3件
### メール（送信）
- 見積のご確認 → example.co.jp
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

1. [Slack アプリを作成](https://api.slack.com/apps?new_app=1)（From scratch、自分のワークスペース）
2. **OAuth & Permissions → User Token Scopes** に `search:read` を追加
3. **Install to Workspace** → 表示される **User OAuth Token**（`xoxp-…`）を貼り付け

取得するもの：今日あなたが送った投稿を、チャンネル別に件数＋冒頭 40 字 × 最大 3 件。DM は件数のみ。

### Google

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. **APIs & Services → Library** で **Gmail API** と **Google Calendar API** を有効化
3. **OAuth consent screen**：External、公開ステータスは **Testing** のまま、**Test users** に自分の Google アカウントを追加
4. **Credentials → Create credentials → OAuth client ID**：種類は **Web application**、**Authorized JavaScript origins** に `https://coolboyhy1607.github.io`（ローカル開発なら `http://localhost:3000` も）
5. 発行された **Client ID**（`….apps.googleusercontent.com`）をアプリに貼り、「Google に接続」

取得するもの：今日送信したメールの件名＋宛先ドメイン（受信は載せません）、今日参加した予定のタイトルと時間帯（辞退・終日は除外）。
アクセストークンは約 1 時間で切れるので、切れたら再度「Google に接続」を押してください。

## 開発

```sh
npm install
npm run dev     # http://localhost:3000/otsukare
npm test        # node --test（純粋ロジックのみ）
npm run build   # out/ に静的出力
```

`main` に push すると GitHub Actions が GitHub Pages にデプロイします。

## 構成

- Next.js（静的エクスポート）＋ TypeScript、依存は next / react のみ
- `lib/github.ts` `lib/slack.ts` `lib/google.ts` … 1 ファイル＝1 ソース。`SourceResult { name, lines, tomorrow? }` を返せば `lib/report.ts` が日報に組み込みます

## 今後

- Microsoft（Outlook メール・カレンダー）
- 2 人目のユーザーが現れたら、サーバーを置いて「Sign in with …」でトークン貼り付けをなくす（Jira / Notion など CORS 不可のサービスもここで）
