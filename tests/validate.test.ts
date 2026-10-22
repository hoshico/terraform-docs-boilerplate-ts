import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parseCommunication } from "../scripts/lib/communication.ts";
import { REQUIREMENTS_PATH } from "../scripts/lib/paths.ts";

const FIXTURES = join(import.meta.dirname, "fixtures");
const VALID = readFileSync(REQUIREMENTS_PATH, "utf-8");

function errorsOf(text: string): string[] {
  const result = parseCommunication(text);
  return result.ok ? [] : result.errors;
}

test("リポジトリの通信要件 YAML は検証を通る", () => {
  expect(parseCommunication(VALID).ok).toBe(true);
});

test("整合性チェックのエラーが Python 版と一致する", () => {
  // expected-errors.txt は移行前の Python 版（validate_communication.py）の出力
  const dir = join(FIXTURES, "invalid-references");
  const expected = readFileSync(join(dir, "expected-errors.txt"), "utf-8").trimEnd().split("\n");
  expect(errorsOf(readFileSync(join(dir, "communication.yaml"), "utf-8"))).toEqual(expected);
});

describe("YAML 構文エラー", () => {
  test("インデント不正", () => {
    expect(errorsOf("network:\n  region: a\n bad: b\n")[0]).toMatch(/^YAML: /);
  });

  test("キーの重複", () => {
    const errors = errorsOf(VALID.replace("network:\n", "network:\n  region: us-east-1\n"));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^YAML: Map keys must be unique/);
  });
});

describe("JSON Schema エラー", () => {
  test.each([
    ["port が範囲外", "port: 3000", "port: 70000", "schema: /communications/1/port must be <= 65535"],
    ["protocol が許可値以外", "protocol: tcp", "protocol: icmp", "schema: /communications/0/protocol must be equal to one of the allowed values"],
    ["必須フィールドの欠落", "    description: 利用者からALBへのHTTPS通信\n", "", "schema: /communications/0 must have required property 'description'"],
    ["未定義のキー", "    port: 443\n", "    port: 443\n    note: x\n", "schema: /communications/0 must NOT have additional properties (note)"],
    ["CIDR の形式", "cidr: 10.0.0.0/16", "cidr: 10.0.0.0", 'schema: /network/vpc/cidr must match pattern "^([0-9]{1,3}\\.){3}[0-9]{1,3}/[0-9]{1,2}$"'],
  ])("%s", (_, search, replacement, expected) => {
    const text = VALID.replace(search, replacement);
    expect(text).not.toBe(VALID);
    expect(errorsOf(text)).toContain(expected);
  });

  test("ルートが空", () => {
    expect(errorsOf("")).toEqual(["schema: / must be object"]);
  });
});
