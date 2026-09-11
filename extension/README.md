# otsukare Autofill（Chrome 拡張機能）

otsukare の「ブラウザから自動入力」ボタン用の拡張機能。ログイン中の Slack / Notion のセッションから
トークンを読み取り、otsukare の入力欄に自動で埋めます。**読み取った値は otsukare のページに渡すだけで、
どこにも送信・保存しません。** 読み取りは**同意画面で「同意する」を押した後にのみ**行われます。

読み取るもの：
- Slack `xoxc-…`（`app.slack.com` を一時的に開き、その API リクエストの `token` を `chrome.webRequest` で取得）
- Slack `xoxd-…`（`slack.com` の HttpOnly Cookie `d`）
- Notion `token_v2`（`notion.so` の HttpOnly Cookie）

HttpOnly Cookie はページの JavaScript からは読めないため、この拡張機能（`cookies` 権限）が必要です。
xoxc は Slack の 2026-01 の変更で `localStorage`（`localConfig_v2`）に保存されなくなったため、
`localStorage` からは取れません。唯一残っている出所である「Slack web クライアント自身の API リクエストの
`token` フィールド」を `webRequest` で拾います（`app.slack.com` を一時タブで開くと起動時の `client.boot`
などが飛ぶので、そこから取得して即座にタブを閉じます）。xoxc はセッションのため定期的に失効するので、
毎回その場で取り直します（古い値をキャッシュしない）。

## 同意の流れ

1. インストール直後に `consent.html`（同意画面）が開く：何を読み取り、どこへ渡すかを明示
2. **同意する** → `chrome.storage.local` に `consent: true` を保存 → otsukare を開く（自動入力が有効）
3. **同意しない** → 何も保存せず閉じる。otsukare 側のボタンは「同意して自動入力」（青）になり、押すと同意画面が再度開く
4. 取り消し：ツールバーの拡張機能アイコン（または `chrome://extensions` → オプション）→「同意を取り消す」

`background.js` は `consent` が無い限りトークンを一切読みません（`getTokens` は `{ error: "consent" }` を返して同意画面を開く）。
otsukare の読み込み時の自動入力も、同意済みのときだけ動きます。

## インストール（load unpacked）— 基本の配布方法

同じ Chrome を使うチームなら、これを **1 回** やれば全員が使えます。ストア公開は不要です。

1. Chrome で `chrome://extensions` を開く
2. 右上の **デベロッパー モード** をオン
3. **パッケージ化されていない拡張機能を読み込む** → この `extension/` フォルダを選択
4. 開いた同意画面で「同意する」→ otsukare に戻り、「Slack・Notion を自動入力」が緑になる

複数台に配る場合は、社内管理の Chrome なら `ExtensionInstallForcelist`（自前ホストの CRX）や Google Workspace の限定公開ストアで配布できます（審査なし）。

`http://localhost/*` と `https://otsukare-six.vercel.app/*`（本番）で動きます。

**重要**：短いエイリアス `otsukare.vercel.app` は**別人が所有**しているため使いません（content script をそこに注入するとトークンを盗まれる恐れがあるため）。独自ドメインや別の公開オリジンに変える場合は、`manifest.json` の `content_scripts.matches` と `background.js` の `WEB_URL` を**その実オリジンに揃えて**変更してください（両者は必ず一致させる）。

## Chrome Web Store への公開（任意・ワンクリック導入にしたい場合）

認証 Cookie を読む拡張機能は**必ず手動審査**になり、却下・後日削除のリスクがあります（同種の
[Get cookies.txt LOCALLY](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc) は公開中、
一方で Cookie を開発者サーバーへ送っていた旧「Get cookies.txt」は削除）。ストアは**あくまで追加の配布経路**として扱い、load unpacked を基本にしてください。

提出前チェックリスト：
1. `manifest.json` に `icons`（128×128 PNG 必須。48 / 16 も推奨）を追加する ← **未対応**
2. [デベロッパー ダッシュボード](https://chrome.google.com/webstore/devconsole/)（初回 $5、2 段階認証必須）で `extension/` の zip をアップロード
3. ストア掲載情報：
   - 単一の目的：「ログイン中の Slack / Notion のセッション情報を otsukare の入力欄に自動入力する」
   - プライバシーポリシー URL：`https://github.com/coolboyhy1607/otsukare/blob/main/extension/PRIVACY.md`
   - 権限の理由：`cookies` + host（Cookie `d` / `token_v2` の読み取り）、`webRequest`（`app.slack.com` の API リクエストから xoxc を取得。ブロックはしない＝観測のみ）、`storage`（同意フラグのみ）
   - 「プライバシーへの取り組み」：**認証情報**を収集にチェック、販売なし・目的外利用なし・Limited Use 準拠を証明
4. 公開後の URL（`https://chromewebstore.google.com/detail/<ID>`）を `lib/extension.ts` の `WEBSTORE_URL` に設定
5. 開発ビルドと ID を揃えたい場合は、ストアの「公開鍵」を `manifest.json` の `key` に貼る

## 権限

- `cookies` + `host_permissions`（`*.slack.com` / `*.notion.so`）… Cookie `d` と `token_v2` の読み取り
- `webRequest` … `*://*.slack.com/*` の API リクエストの `token`（xoxc）を**観測のみ**で取得（ブロック・改変はしない）。`app.slack.com` を一時タブで開いて起動リクエストを飛ばし、取得したら閉じる
- `storage` … 同意フラグ `consent` の保存のみ（トークンは保存しない）
