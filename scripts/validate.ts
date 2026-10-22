/**
 * 通信要件 YAML を検証する（YAML 構文・JSON Schema・整合性チェック）。
 *
 * 使い方: pnpm validate [YAML のパス]（省略時は requirements/communication.yaml）
 */

import { resolve } from "node:path";
import { loadCommunication } from "./lib/communication.ts";
import { REQUIREMENTS_PATH } from "./lib/paths.ts";

const path = process.argv[2] ? resolve(process.argv[2]) : REQUIREMENTS_PATH;
const result = loadCommunication(path);

if (!result.ok) {
  for (const error of result.errors) {
    console.error(`ERROR: ${error}`);
  }
  process.exit(1);
}

console.log(`OK: ${path}`);
