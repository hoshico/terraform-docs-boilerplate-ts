# 開発環境のバージョン管理方針

Mac / Windows / CI（GitHub Actions）でツールのバージョン差異を出さないための方針。

> ステータス：mise / pnpm を導入済み（`mise.toml`, `package.json`, `pnpm-lock.yaml`）。
> `.gitattributes` 作成済み。Terraform の lock ファイルは未作成。

## 前提

- Docker（Dev Container 含む）は使用しない
- 検証・生成スクリプトは TypeScript で書き、Node.js（tsx）で実行する（[AGENTS.md](../AGENTS.md) 参照）

## 全体像

| 対象 | 固定方法 | コミットするファイル |
|---|---|---|
| Terraform / Node.js / pnpm | mise | `mise.toml` |
| npm パッケージ | pnpm | `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` |
| Terraform プロバイダ | lock ファイル | `.terraform.lock.hcl` |
| 改行コード | Git | `.gitattributes` |
| draw.io | CI で固定 / ローカルは推奨バージョンを記載 | なし |

## 1. CLI ツール：mise

[mise](https://mise.jdx.dev/) でツールのバージョンをリポジトリ単位で固定する。Windows / Mac / Linux 対応。

```toml
# mise.toml
[tools]
terraform = "1.16.4"
node = "24.22.1"
pnpm = "12.4.1"
```

インストール：

```sh
# Windows
winget install jdx.mise
# Mac
brew install mise

# リポジトリ直下で
mise trust
mise install
```

CI では `jdx/mise-action` を使い、同じ `mise.toml` を読み込む。

## 2. npm パッケージ：pnpm

[pnpm](https://pnpm.io/) で依存を管理し、`pnpm-lock.yaml` で間接依存まで固定する。
`package.json` の `packageManager` にも pnpm のバージョンを記載し、`mise.toml` と揃える。

| パッケージ | 用途 |
|---|---|
| `tsx` | TypeScript をビルドせずに実行 |
| `typescript` | 型チェック（`pnpm typecheck`） |
| `yaml` | YAML の読み込み |
| `ajv` | JSON Schema 検証（`requirements/communication.schema.json` をそのまま使う） |
| `vitest` | 生成結果の回帰テスト |

```sh
pnpm install                    # 依存のインストール
pnpm validate                   # 通信要件 YAML の検証
pnpm generate                   # CSV・README の表・draw.io を生成
pnpm generate:svg               # SVG を生成
pnpm typecheck                  # 型チェック
pnpm test                       # 回帰テスト
```

- `pnpm <script>` を使うことで、OS ごとのコマンドの違いを吸収する
- 依存パッケージは最小限に留める。CSV と XML の出力は自前で実装している
- 依存パッケージのインストールスクリプトは `pnpm-workspace.yaml` の `allowBuilds` で許可したものだけ実行する

## 3. Terraform

- `versions.tf` で本体バージョンを制約する

  ```hcl
  terraform {
    required_version = "~> 1.16.0"
  }
  ```

- `.terraform.lock.hcl` をコミットする。生成時は全 OS 分のハッシュを記録する（Windows で `init` した際の差分を防ぐ）

  ```sh
  terraform providers lock \
    -platform=windows_amd64 \
    -platform=darwin_arm64 \
    -platform=linux_amd64
  ```

## 4. Windows 対策

- `.gitattributes` で改行を LF に統一する

  ```gitattributes
  * text=auto eol=lf
  ```

- 自動化スクリプトは shell ではなく TypeScript で書く
- パス操作は `node:path` を使う
- ファイル出力時は UTF-8・改行 LF を明示し、OS による生成物の差分を防ぐ

## 5. draw.io

draw.io は mise / pnpm で管理できず、バージョンにより SVG 出力が変わる可能性がある。

- CI では固定バージョン（`.github/workflows/docs.yml` の `DRAWIO_VERSION`）で SVG を生成し、コミット済みの SVG と異なる場合は警告を出す
- ローカルでの SVG 生成は確認用とする（Mac で確認済みのバージョン：32.4.1）
- ローカルでもバージョンを揃える場合は、推奨バージョンを指定してインストールする

  ```sh
  # Windows
  winget install JGraph.Draw --version <推奨バージョン>
  # Mac
  brew install --cask drawio
  ```
