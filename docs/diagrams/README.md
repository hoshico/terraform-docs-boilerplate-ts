# diagrams

`requirements/communication.yaml` から自動生成される構成図（draw.io / SVG）を配置するディレクトリ。

生成物のため直接編集しない。

| ファイル | 生成コマンド |
|---|---|
| `communication.drawio` | `pnpm generate:drawio` |
| `communication.svg` | `pnpm generate:svg`（draw.io デスクトップが必要） |

SVG は draw.io のバージョンにより出力が変わる可能性がある。CI（固定バージョン）でも生成し、コミット済みの SVG と異なる場合は警告を出す（生成した SVG は Artifact からダウンロードできる）。
