/**
 * 生成結果の回帰テスト。
 *
 * tests/fixtures/<ケース>/expected.* はゴールデンファイル。
 * 生成結果がバイト単位で一致することを確認する。生成処理を意図して変更した場合は更新する。
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { type CommunicationRequirements, loadCommunication } from "../scripts/lib/communication.ts";
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

  test("CSV が期待値と一致する", () => {
    expect(toCsv(buildRows(data))).toBe(read(join(dir, "expected.csv")));
  });

  test("README の表が期待値と一致する", () => {
    const template = `# test\n\n${README_BEGIN}\n${README_END}\n\nfooter\n`;
    expect(replaceReadmeTable(template, buildRows(data))).toBe(read(join(dir, "expected-readme.md")));
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
