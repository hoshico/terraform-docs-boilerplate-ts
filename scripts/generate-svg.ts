/**
 * draw.io CLI で構成図を SVG（docs/diagrams/communication.svg）にエクスポートする。
 *
 * draw.io の実行ファイルは以下の順で探す。
 *
 * 1. 環境変数 DRAWIO_PATH
 * 2. PATH 上の drawio / draw.io
 * 3. OS ごとの標準インストール先
 */

import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { delimiter, join } from "node:path";
import { DRAWIO_PATH, SVG_PATH, fromRoot } from "./lib/paths.ts";

const DEFAULT_LOCATIONS = [
  "/Applications/draw.io.app/Contents/MacOS/draw.io",
  join(process.env.ProgramFiles ?? "C:\\Program Files", "draw.io", "draw.io.exe"),
  join(process.env.LOCALAPPDATA ?? "", "Programs", "draw.io", "draw.io.exe"),
];

const isFile = (path: string) => existsSync(path) && statSync(path).isFile();

function which(name: string): string | undefined {
  const extensions = process.platform === "win32" ? [".exe", ""] : [""];
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    for (const ext of extensions) {
      const candidate = join(dir, name + ext);
      if (dir && isFile(candidate)) {
        return candidate;
      }
    }
  }
  return undefined;
}

function findDrawio(): string | undefined {
  if (process.env.DRAWIO_PATH) {
    return process.env.DRAWIO_PATH;
  }
  for (const name of ["drawio", "draw.io"]) {
    const found = which(name);
    if (found) {
      return found;
    }
  }
  return DEFAULT_LOCATIONS.find(isFile);
}

const drawio = findDrawio();
if (drawio === undefined) {
  console.error("ERROR: draw.io が見つかりません。インストールするか DRAWIO_PATH を設定してください");
  process.exit(1);
}

const args = ["--export", "--format", "svg", "--output", SVG_PATH, DRAWIO_PATH];
// Linux（CI）では Electron のサンドボックスを無効にしないと起動できない
if (process.platform === "linux") {
  args.push("--no-sandbox");
}

const result = spawnSync(drawio, args, { stdio: "inherit" });
if (result.error) {
  console.error(`ERROR: draw.io の実行に失敗しました: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Generated: ${fromRoot(SVG_PATH)}`);
