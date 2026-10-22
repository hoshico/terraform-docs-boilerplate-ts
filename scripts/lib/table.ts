/**
 * 通信要件一覧（CSV / README の Markdown 表）の組み立て。
 */

import type { CommunicationRequirements } from "./communication.ts";

export const HEADER = ["ID", "Source", "Destination", "Via", "Protocol", "Port", "Description"];

export const README_BEGIN = "<!-- BEGIN: communication-table (自動生成のため直接編集しない) -->";
export const README_END = "<!-- END: communication-table -->";

const BOM = "\uFEFF";

export function buildRows(data: CommunicationRequirements): string[][] {
  return data.communications.map((comm) => [
    comm.id,
    comm.source,
    comm.destination,
    comm.via ?? "",
    comm.protocol,
    String(comm.port),
    comm.description,
  ]);
}

function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** Excel（Windows）で文字化けしないよう、BOM 付き・改行 LF の CSV 文字列を返す。 */
export function toCsv(rows: string[][]): string {
  return BOM + [HEADER, ...rows].map((row) => row.map(csvField).join(",") + "\n").join("");
}

function markdownCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", "<br>");
}

export function toMarkdownTable(rows: string[][]): string {
  return [
    `| ${HEADER.join(" | ")} |`,
    "|" + "---|".repeat(HEADER.length),
    ...rows.map((row) => `| ${row.map(markdownCell).join(" | ")} |`),
  ].join("\n");
}

/** README の目印コメントの間を表で置き換える。目印がない場合は undefined を返す。 */
export function replaceReadmeTable(readme: string, rows: string[][]): string | undefined {
  const begin = readme.indexOf(README_BEGIN);
  const end = readme.indexOf(README_END);
  if (begin === -1 || end === -1 || end < begin) {
    return undefined;
  }
  return readme.slice(0, begin + README_BEGIN.length) + "\n" + toMarkdownTable(rows) + "\n" + readme.slice(end);
}
