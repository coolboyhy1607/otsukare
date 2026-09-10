export type SourceResult = { name: string; lines: string[]; tomorrow?: string[] };

export const today = () => new Date().toLocaleDateString("sv-SE");

/** [00:00, 24:00) of `date` (YYYY-MM-DD) in the browser's local timezone. */
export const dayRange = (date: string) => {
  const start = new Date(`${date}T00:00:00`);
  return { start, end: new Date(start.getTime() + 86_400_000) };
};

export const hhmm = (d: Date) =>
  d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });

const ORDER = ["GitHub", "Slack", "メール（送信）", "会議"];

export function render(date: string, results: SourceResult[]): string {
  const sorted = [...results].sort((a, b) => ORDER.indexOf(a.name) - ORDER.indexOf(b.name));
  const out = [`# 日報 ${date}`, "", "## やったこと"];
  for (const r of sorted) if (r.lines.length) out.push(`### ${r.name}`, ...r.lines);
  const tomorrow = sorted.flatMap((r) => r.tomorrow ?? []);
  out.push("", "## 明日やること", ...tomorrow, "- ", "", "## 困っていること", "- ");
  return out.join("\n");
}
