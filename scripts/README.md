# scripts

検証・生成用の TypeScript スクリプトを配置するディレクトリ。

[tsx](https://tsx.is/) でビルドせずに実行する。リポジトリ直下で `pnpm <コマンド>` として実行する。

| スクリプト | コマンド | 内容 |
|---|---|---|
| `validate.ts` | `pnpm validate [YAML のパス]` | 通信要件 YAML の検証（YAML 構文・JSON Schema・整合性チェック） |
| `generate-csv.ts` | `pnpm generate:csv` | 通信要件一覧 CSV（`docs/tables/communication.csv`）を生成し、README.md の通信要件一覧の表を更新 |
| `generate-drawio.ts` | `pnpm generate:drawio` | 構成図（`docs/diagrams/communication.drawio`）を生成 |
| `generate-svg.ts` | `pnpm generate:svg` | draw.io CLI で構成図を SVG（`docs/diagrams/communication.svg`）に出力 |

`pnpm generate` で CSV と draw.io をまとめて生成する。

| ファイル | 内容 |
|---|---|
| `lib/communication.ts` | YAML の読み込み・JSON Schema 検証（Ajv）・整合性チェック |
| `lib/table.ts` | CSV / Markdown 表の組み立て |
| `lib/diagram.ts` | draw.io 構成図のレイアウトとスタイル |
| `lib/xml.ts` | draw.io 用の XML 出力 |
| `lib/paths.ts` | 入出力ファイルのパス |

生成スクリプト（`generate-*.ts`）は実行前に検証を行い、失敗した場合は生成を中断する。

`generate-svg.ts` は draw.io の実行ファイルを環境変数 `DRAWIO_PATH` → PATH → OS ごとの標準インストール先の順で探す。

## テスト

`pnpm test`（Vitest）で以下を確認する。

- `tests/fixtures/<ケース>/expected.*`（ゴールデンファイル）と生成結果が一致する
- 不正な YAML で検証エラーになる

リポジトリの生成物（CSV・README の表・draw.io）が最新であることは、CI の差分チェックで確認する。
