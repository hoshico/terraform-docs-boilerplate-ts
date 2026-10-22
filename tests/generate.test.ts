/**
 * 生成結果の回帰テスト。
 *
 * tests/fixtures/<ケース>/expected.* は、移行前の Python 版スクリプトで生成したゴールデンファイル。
 * TypeScript 版の出力がバイト単位で一致することを確認する。
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test, vi } from "vitest";
import { type CommunicationRequirements, loadCommunication } from "../scripts/lib/communication.ts";
import { buildDiagram } from "../scripts/lib/diagram.ts";
import { DRAWIO_PATH, CSV_PATH, README_PATH, REQUIREMENTS_PATH } from "../scripts/lib/paths.ts";
import { README_BEGIN, README_END, buildRows, replaceReadmeTable, toCsv } from "../scripts/lib/table.ts";

const FIXTURES = join(import.meta.dirname, "fixtures");
const GOLDEN_CASES = readdirSync(FIXTURES).filter((name) => !name.startsWith("invalid"));

const read = (path: string) => readFileSync(path, "utf-8");

function load(path: string): CommunicationRequirements {
  const result = loadCommunication(path);
  if (!result.ok) {
    throw new Error(result.errors.join("\n"));
  }
  return result.data;
}

describe.each(GOLDEN_CASES)("%s", (name) => {
  const dir = join(FIXTURES, name);
  const data = load(join(dir, "communication.yaml"));

  test("CSV が Python 版と一致する", () => {
    expect(toCsv(buildRows(data))).toBe(read(join(dir, "expected.csv")));
  });

  test("README の表が Python 版と一致する", () => {
    const template = `# test\n\n${README_BEGIN}\n${README_END}\n\nfooter\n`;
    expect(replaceReadmeTable(template, buildRows(data))).toBe(read(join(dir, "expected-readme.md")));
  });

  test("draw.io が Python 版と一致する", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(buildDiagram(data)).toBe(read(join(dir, "expected.drawio")));
  });

  test("同じ入力から同じ結果を生成する", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(buildDiagram(load(join(dir, "communication.yaml")))).toBe(buildDiagram(data));
    expect(toCsv(buildRows(load(join(dir, "communication.yaml"))))).toBe(toCsv(buildRows(data)));
  });
});

describe("リポジトリの生成物", () => {
  // CI の差分チェックと同じ内容をローカルのテストでも確認する
  const data = load(REQUIREMENTS_PATH);

  test("docs/tables/communication.csv が最新", () => {
    expect(read(CSV_PATH)).toBe(toCsv(buildRows(data)));
  });

  test("README.md の通信要件一覧が最新", () => {
    const readme = read(README_PATH);
    expect(replaceReadmeTable(readme, buildRows(data))).toBe(readme);
  });

  test("docs/diagrams/communication.drawio が最新", () => {
    expect(read(DRAWIO_PATH)).toBe(buildDiagram(data));
  });
});

describe("README の目印コメント", () => {
  test("目印がない場合は undefined を返す", () => {
    expect(replaceReadmeTable("# no markers\n", [])).toBeUndefined();
  });

  test("END が BEGIN より前にある場合は undefined を返す", () => {
    expect(replaceReadmeTable(`${README_END}\n${README_BEGIN}\n`, [])).toBeUndefined();
  });
});
