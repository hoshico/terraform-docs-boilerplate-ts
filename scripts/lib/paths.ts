import { relative, resolve } from "node:path";

export const ROOT = resolve(import.meta.dirname, "..", "..");
export const REQUIREMENTS_PATH = resolve(ROOT, "requirements", "communication.yaml");
export const CSV_PATH = resolve(ROOT, "docs", "tables", "communication.csv");
export const README_PATH = resolve(ROOT, "README.md");
export const DRAWIO_PATH = resolve(ROOT, "docs", "diagrams", "communication.drawio");
export const SVG_PATH = resolve(ROOT, "docs", "diagrams", "communication.svg");

/** ログ出力用にリポジトリ直下からの相対パス（区切り文字は / ）にする。 */
export function fromRoot(path: string): string {
  return relative(ROOT, path).split("\\").join("/");
}
