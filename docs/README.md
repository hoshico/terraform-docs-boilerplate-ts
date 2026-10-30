# docs

設計書・運用手順書などのドキュメントを配置するディレクトリ。

## 開発環境のバージョン管理方針

Mac / Windows / CI でツールのバージョン差異を出さないため、Terraform・Node.js・pnpm は `mise.toml`、npm パッケージは `package.json` と `pnpm-lock.yaml` で固定する。

```sh
mise trust
mise install
pnpm install
pnpm validate
pnpm generate
pnpm typecheck
pnpm test
```

検証・生成スクリプトは TypeScript と Node.js（tsx）で実行する。改行コードは `.gitattributes` で LF に統一し、ファイル出力時も UTF-8・LF を明示する。

draw.io は mise / pnpm で管理できないため、構成図は `requirements/communication.yaml` を正本として AI が編集する。編集時は [diagrams/AGENTS.md](diagrams/AGENTS.md) に従い、更新後にローカルで SVG を出力・確認する。Mac で確認済みの draw.io バージョンは 32.4.1。
