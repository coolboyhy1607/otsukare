# otsukare token filler — プライバシーポリシー / Privacy Policy

最終更新 / Last updated: 2026-09-11

## 日本語

**単一の目的**：この拡張機能は、日報下書きツール otsukare（https://otsukare-six.vercel.app/）の入力欄に、あなたのブラウザにあるSlack / Notion のセッション情報を自動入力することだけを行います。

**読み取る情報（認証情報）**
- Slack：Cookie `d`（xoxd）、および `app.slack.com` のローカルストレージにあるセッショントークン（xoxc）
- Notion：Cookie `token_v2`

**読み取るタイミング**：拡張機能内の同意画面で「同意する」を押した後、かつ otsukare のページで自動入力を求めたときだけです。同意前は何も読み取りません。同意はツールバーの拡張機能アイコン（または拡張機能のオプション）からいつでも取り消せ、取り消すと読み取りは停止します。

**使い方・送信先**：読み取った値は otsukare のページに渡され、そのブラウザの localStorage に保存されます。otsukare があなたの Slack / Notion に問い合わせる際、値は otsukare の中継 API（同一オリジン）を経由して Slack / Notion にのみ送られます。中継 API は値を保存・記録しません。開発者や第三者に送信されることはなく、販売・広告・分析目的で利用されることもありません。

**拡張機能が保存するもの**：同意の有無（`consent` フラグ）のみ。トークンは拡張機能内に保存しません。

**変更の通知**：データの取り扱いを変更する場合は、拡張機能の更新時に同意画面を再表示し、改めて同意を求めます。

**Chrome Web Store ユーザーデータポリシー**：Chrome API から取得した情報の利用は、Limited Use（限定的な使用）の要件を含む Chrome Web Store ユーザーデータポリシーに従います。

**連絡先**：https://github.com/coolboyhy1607/otsukare/issues

## English

**Single purpose**: this extension does one thing — it fills the Slack / Notion session credentials already present in your browser into the input fields of otsukare (https://otsukare-six.vercel.app/), a daily-report drafting tool.

**Data read (authentication information)**
- Slack: the `d` cookie (xoxd) and the session token (xoxc) stored in `app.slack.com`'s localStorage
- Notion: the `token_v2` cookie

**When**: only after you click "Agree" on the extension's consent page, and only when the otsukare page asks for auto-fill. Nothing is read before consent. You can withdraw consent at any time from the extension's toolbar icon (or its options page); reading stops immediately.

**Use and transfer**: the values are handed to the otsukare page and stored in that browser's localStorage. When otsukare queries your Slack / Notion, the values pass through otsukare's same-origin relay API to Slack / Notion only. The relay stores and logs nothing. The values are never sent to the developer or any third party, and are never sold or used for advertising or analytics.

**What the extension stores**: only the `consent` flag. No tokens are stored inside the extension.

**Changes**: if data handling ever changes, the consent page is shown again on update and consent is requested anew.

**Chrome Web Store User Data Policy**: the use of information received from Chrome APIs adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements.

**Contact**: https://github.com/coolboyhy1607/otsukare/issues
