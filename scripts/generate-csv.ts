/**
 * 通信要件 YAML から通信要件一覧を生成する。
 *
 * - CSV：Excel（Windows）で文字化けしないよう、BOM 付き UTF-8 で出力する
 * - README：目印コメントの間を Markdown の表で書き換える
 */

import { readFileSync, writeFileSync } from "node:fs";
import { loadCommunicationOrExit } from "./lib/communication.ts";
import { CSV_PATH, README_PATH, fromRoot } from "./lib/paths.ts";
import { README_BEGIN, README_END, buildRows, replaceReadmeTable, toCsv } from "./lib/table.ts";

const rows = buildRows(loadCommunicationOrExit());

writeFileSync(CSV_PATH, toCsv(rows), "utf-8");
console.log(`Generated: ${fromRoot(CSV_PATH)}`);

const readme = replaceReadmeTable(readFileSync(README_PATH, "utf-8"), rows);
if (readme === undefined) {
  console.error(`ERROR: README.md に目印コメント（${README_BEGIN} / ${README_END}）がありません`);
  process.exit(1);
}
writeFileSync(README_PATH, readme, "utf-8");
console.log(`Updated: ${fromRoot(README_PATH)}`);
