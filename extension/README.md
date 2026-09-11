# otsukare token filler（Chrome 拡張機能）

otsukare の「ブラウザから自動入力」ボタン用の拡張機能。ログイン中の Slack / Notion のセッションから
トークンを読み取り、otsukare の入力欄に自動で埋めます。**読み取った値は otsukare のページに渡すだけで、
どこにも送信・保存しません。**

読み取るもの：
- Slack `xoxc-…`（`app.slack.com` の `localStorage.localConfig_v2`）
- Slack `xoxd-…`（`slack.com` の HttpOnly Cookie `d`）
- Notion `token_v2`（`notion.so` の HttpOnly Cookie）

HttpOnly Cookie はページの JavaScript からは読めないため、この拡張機能（`chrome.cookies` 権限）が必要です。

## 開発時のインストール（load unpacked）

1. Chrome で `chrome://extensions` を開く
2. 右上の **デベロッパー モード** をオン
3. **パッケージ化されていない拡張機能を読み込む** → この `extension/` フォルダを選択
4. otsukare を開くと「Slack・Notion を自動入力」が緑（拡張機能あり）になる

`http://localhost/*` と `https://otsukare.vercel.app/*` で動きます。デプロイ先が違う場合は
`manifest.json` の `content_scripts.matches` と `background.js` の `WEB_URL` を実際のオリジンに変更してください。

## Chrome Web Store への公開（ワンクリック導入にする場合）

otsukare 側の「拡張機能をインストール」ボタンは Web Store のリンクを開く前提です。

1. [Chrome Web Store デベロッパー ダッシュボード](https://chrome.google.com/webstore/devconsole/)（初回のみ $5）
2. この `extension/` を zip にしてアップロード → 審査（セッション Cookie を読むため、用途の説明を求められることがあります）
3. 公開後の URL（`https://chromewebstore.google.com/detail/<ID>`）を `lib/extension.ts` の `WEBSTORE_URL` に設定
4. 開発ビルドと ID を揃えたい場合は、ストアの「公開鍵」を `manifest.json` の `key` に貼る

## 権限

- `cookies` + `host_permissions`（`*.slack.com` / `*.notion.so`）… Cookie `d` と `token_v2` の読み取り
- `scripting` … `app.slack.com` のタブで `localConfig_v2` から xoxc を読む（開いていなければ一時タブを開いて読み、閉じます）
