import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "otsukare — 日報の下書きを2秒で",
  description: "GitHub・Slack・Notion・Gmail・Outlook・カレンダーの今日の活動から日報の下書きを生成。トークンはブラウザにだけ保存。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
