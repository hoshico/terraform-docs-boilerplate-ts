/**
 * 通信要件 YAML から draw.io 構成図（docs/diagrams/communication.drawio）を生成する。
 */

import { writeFileSync } from "node:fs";
import { loadCommunicationOrExit } from "./lib/communication.ts";
import { buildDiagram } from "./lib/diagram.ts";
import { DRAWIO_PATH, fromRoot } from "./lib/paths.ts";

writeFileSync(DRAWIO_PATH, buildDiagram(loadCommunicationOrExit()), "utf-8");
console.log(`Generated: ${fromRoot(DRAWIO_PATH)}`);
