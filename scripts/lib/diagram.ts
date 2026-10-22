/**
 * 通信要件から draw.io 構成図（XML）を組み立てる。
 *
 * Region > VPC > AZ > サブネットの枠を描き、resources を subnet / layout に従って配置する。
 * subnet を持たないリソース（Users など）は Region の上に並べる。
 * via を持つ通信は「source -> via -> destination」の 2 本の矢印で描く。
 * 矢印と重ならないよう、リソース名はアイコンの右側に表示する。
 */

import type { CommunicationRequirements } from "./communication.ts";
import { type XmlElement, element, toXmlString } from "./xml.ts";

// 以下のスタイルは draw.io の AWS4 アイコンライブラリ（mxgraph.aws4.*）に合わせる

// リソースタイプ -> [アイコン識別子, AWS カテゴリ色]。サービスアイコン（背景色付き）として描く
const SERVICE_ICONS: Record<string, [string, string]> = {
  aws_alb: ["elastic_load_balancing", "#8C4FFF"],
  aws_ecs: ["ecs", "#ED7100"],
  aws_rds: ["rds", "#C925D1"],
};
// リソースタイプ -> [シェイプ名, 色]。背景なしのアイコンとして描く
const PLAIN_ICONS: Record<string, [string, string]> = {
  aws_nat_gateway: ["nat_gateway", "#8C4FFF"],
  users: ["users", "#232F3D"],
  internet: ["internet", "#232F3D"],
};

const LABEL_RIGHT = "labelPosition=right;verticalLabelPosition=middle;align=left;verticalAlign=middle;spacingLeft=8;";
const ICON_BASE =
  "sketch=0;outlineConnect=0;fontColor=#232F3E;gradientColor=none;dashed=0;" +
  "html=0;fontSize=12;fontStyle=0;aspect=fixed;pointerEvents=1;" +
  LABEL_RIGHT;
const serviceIconStyle = (icon: string, color: string) =>
  ICON_BASE + `fillColor=${color};strokeColor=#ffffff;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.${icon};`;
const plainIconStyle = (icon: string, color: string) =>
  ICON_BASE + `fillColor=${color};strokeColor=none;shape=mxgraph.aws4.${icon};`;
// VPC の枠線上に置くため、ラベルに背景色を付けて枠線と重ならないようにする
const IGW_STYLE = plainIconStyle("internet_gateway", "#8C4FFF") + "labelBackgroundColor=#ffffff;";
const FALLBACK_STYLE = "rounded=1;whiteSpace=wrap;html=0;fontColor=#232F3E;strokeColor=#232F3E;";

const GROUP_BASE =
  "outlineConnect=0;gradientColor=none;html=0;whiteSpace=wrap;fontSize=12;fontStyle=0;" +
  "pointerEvents=0;verticalAlign=top;align=left;spacingLeft=30;dashed=0;shape=mxgraph.aws4.group;";
const REGION_STYLE =
  GROUP_BASE + "grIcon=mxgraph.aws4.group_region;strokeColor=#00A4A6;fillColor=none;fontColor=#147EBA;dashed=1;";
const VPC_STYLE = GROUP_BASE + "grIcon=mxgraph.aws4.group_vpc2;strokeColor=#8C4FFF;fillColor=none;fontColor=#AAB7B8;";
const SUBNET_STYLES = {
  public:
    GROUP_BASE +
    "grIcon=mxgraph.aws4.group_security_group;grStroke=0;strokeColor=#7AA116;fillColor=#F2F6E8;fontColor=#248814;",
  private:
    GROUP_BASE +
    "grIcon=mxgraph.aws4.group_security_group;grStroke=0;strokeColor=#00A4A6;fillColor=#E6F6F7;fontColor=#147EBA;",
};
// AZ 名は左寄せにして、上方向へ伸びる矢印と重ならないようにする
const AZ_STYLE =
  "fillColor=none;strokeColor=#147EBA;dashed=1;verticalAlign=top;align=left;spacingLeft=10;fontStyle=0;fontColor=#147EBA;whiteSpace=wrap;html=0;";

const EDGE_STYLE =
  "endArrow=block;endFill=1;html=0;fontSize=12;" + "strokeColor=#232F3E;fontColor=#232F3E;labelBackgroundColor=#ffffff;";
const REPLICATION_STYLE =
  "endArrow=none;dashed=1;html=0;fontSize=11;" + "strokeColor=#C925D1;fontColor=#C925D1;labelBackgroundColor=#ffffff;";

// レイアウト（px）
const ICON = 60;
const MARGIN = 40;
const EXTERNAL_Y = 20;
const EXTERNAL_STEP = 220;
const EXTERNAL_LANE_Y = 120;
const REGION_Y = 200;
const GROUP_PAD = 30;
const GROUP_HEADER = 40;
const VPC_HEADER = 50;
const AZ_W = 440;
const AZ_GAP = 40;
const AZ_HEADER = 40;
const SUBNET_PAD = 20;
const SUBNET_H = 170;
const SUBNET_GAP = 20;
const ICON_OFFSET_X = 180;
const ICON_OFFSET_Y = 65;
const ICON_STEP_X = 170;
const REPLICATION_DROP = 25;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Point = [number, number];

const centerX = (box: Box) => box.x + box.w / 2;

/** 図上に描くアイコン 1 つ分。per_az などでは 1 リソースが複数ノードになる。 */
interface Node {
  cellId: string;
  label: string;
  style: string;
  box: Box;
  az: number | undefined;
  row: number | undefined;
}

class Diagram {
  readonly cells: XmlElement[] = [element("mxCell", { id: "0" }), element("mxCell", { id: "1", parent: "0" })];

  vertex(cellId: string, label: string, style: string, box: Box): void {
    const geometry = element("mxGeometry", {
      x: fmt(box.x),
      y: fmt(box.y),
      width: fmt(box.w),
      height: fmt(box.h),
      as: "geometry",
    });
    this.cells.push(element("mxCell", { id: cellId, value: label, style, vertex: "1", parent: "1" }, [geometry]));
  }

  edge(
    cellId: string,
    label: string,
    style: string,
    source: string,
    target: string,
    labelPos = 0,
    points?: Point[],
  ): void {
    const attrs: Record<string, string> = { relative: "1", as: "geometry" };
    if (labelPos) {
      attrs.x = fmt(labelPos);
    }
    const children = points
      ? [element("Array", { as: "points" }, points.map(([x, y]) => element("mxPoint", { x: fmt(x), y: fmt(y) })))]
      : [];
    this.cells.push(
      element("mxCell", { id: cellId, value: label, style, edge: "1", parent: "1", source, target }, [
        element("mxGeometry", attrs, children),
      ]),
    );
  }

  toXml(): string {
    const model = element("mxGraphModel", { grid: "1", gridSize: "10", background: "#ffffff" }, [
      element("root", {}, this.cells),
    ]);
    return toXmlString(element("mxfile", {}, [element("diagram", { id: "communication", name: "communication" }, [model])]));
  }
}

/** 整数は小数点なしで出力する（JavaScript の数値の文字列化と同じ）。 */
function fmt(value: number): string {
  return String(value);
}

function resourceStyle(resourceType: string): string {
  const service = SERVICE_ICONS[resourceType];
  if (service) {
    return serviceIconStyle(...service);
  }
  const plain = PLAIN_ICONS[resourceType];
  if (plain) {
    return plainIconStyle(...plain);
  }
  console.warn(`WARNING: ${resourceType} のアイコンが未定義のため矩形で表示します`);
  return FALLBACK_STYLE;
}

/** 検証済みの通信要件から draw.io の XML 文字列を組み立てる。 */
export function buildDiagram(data: CommunicationRequirements): string {
  const network = data.network;
  const azs = network.availability_zones;
  const subnets = network.subnets;
  const resources = data.resources;

  // 枠の位置を計算する
  const azH = AZ_HEADER + subnets.length * SUBNET_H + (subnets.length - 1) * SUBNET_GAP + SUBNET_PAD;
  const vpcW = 2 * GROUP_PAD + azs.length * AZ_W + (azs.length - 1) * AZ_GAP;
  const vpc: Box = { x: MARGIN + GROUP_PAD, y: REGION_Y + GROUP_HEADER, w: vpcW, h: VPC_HEADER + azH + GROUP_PAD };
  const region: Box = { x: MARGIN, y: REGION_Y, w: vpc.w + 2 * GROUP_PAD, h: GROUP_HEADER + vpc.h + GROUP_PAD };
  const azBoxes: Box[] = azs.map((_, i) => ({
    x: vpc.x + GROUP_PAD + i * (AZ_W + AZ_GAP),
    y: vpc.y + VPC_HEADER,
    w: AZ_W,
    h: azH,
  }));
  const subnetRows = new Map(subnets.map((subnet, row) => [subnet.id, row]));

  const subnetBox = (row: number, az: number): Box => {
    const azBox = azBoxes[az]!;
    return {
      x: azBox.x + SUBNET_PAD,
      y: azBox.y + AZ_HEADER + row * (SUBNET_H + SUBNET_GAP),
      w: AZ_W - 2 * SUBNET_PAD,
      h: SUBNET_H,
    };
  };

  // リソースをノードに展開する
  const nodes = new Map<string, Node[]>();
  const slotInSubnet = new Map<string, number>();

  for (const [resourceId, resource] of Object.entries(resources)) {
    if (resource.subnet === undefined) {
      continue;
    }
    const style = resourceStyle(resource.type);
    const label = resource.label;
    const row = subnetRows.get(resource.subnet)!;
    const layout = resource.layout ?? "single";

    if (layout === "span") {
      const y = subnetBox(row, 0).y + ICON_OFFSET_Y;
      const box = { x: centerX(vpc) - ICON / 2, y, w: ICON, h: ICON };
      nodes.set(resourceId, [{ cellId: `resource-${resourceId}`, label, style, box, az: undefined, row }]);
      continue;
    }

    const slot = slotInSubnet.get(resource.subnet) ?? 0;
    slotInSubnet.set(resource.subnet, slot + 1);

    const place = (az: number): Box => {
      const sb = subnetBox(row, az);
      return { x: sb.x + ICON_OFFSET_X + slot * ICON_STEP_X, y: sb.y + ICON_OFFSET_Y, w: ICON, h: ICON };
    };

    if (layout === "per_az") {
      nodes.set(
        resourceId,
        azs.map((az, i) => ({ cellId: `resource-${resourceId}-${az}`, label, style, box: place(i), az: i, row })),
      );
    } else if (layout === "primary_standby") {
      nodes.set(resourceId, [
        { cellId: `resource-${resourceId}-primary`, label: `${label}\n(Primary)`, style, box: place(0), az: 0, row },
        { cellId: `resource-${resourceId}-standby`, label: `${label}\n(Standby)`, style, box: place(1), az: 1, row },
      ]);
    } else {
      nodes.set(resourceId, [{ cellId: `resource-${resourceId}`, label, style, box: place(0), az: 0, row }]);
    }
  }

  // VPC 外のリソース。via 経由で到達する宛先は、最後の経由ノードの真上に置く。
  // それ以外（Users など）は VPC の中央上（Internet Gateway の真上）に並べる
  const viaTargets = new Map<string, string>();
  for (const comm of data.communications) {
    if (comm.via !== undefined) {
      viaTargets.set(comm.destination, comm.via);
    }
  }
  const centered = Object.entries(resources)
    .filter(([id, r]) => r.subnet === undefined && !viaTargets.has(id))
    .map(([id]) => id);
  for (const [resourceId, resource] of Object.entries(resources)) {
    if (resource.subnet !== undefined) {
      continue;
    }
    let x: number;
    const via = viaTargets.get(resourceId);
    if (via !== undefined) {
      x = nodes.get(via)!.at(-1)!.box.x;
    } else {
      const j = centered.indexOf(resourceId);
      x = centerX(vpc) - ICON / 2 + (j - (centered.length - 1) / 2) * EXTERNAL_STEP;
    }
    const box = { x, y: EXTERNAL_Y, w: ICON, h: ICON };
    nodes.set(resourceId, [
      {
        cellId: `resource-${resourceId}`,
        label: resource.label,
        style: resourceStyle(resource.type),
        box,
        az: undefined,
        row: undefined,
      },
    ]);
  }

  /** 矢印の接続位置と経由点を返す。横位置が異なる場合は、行間の隙間を通して直角に結ぶ。 */
  const route = (s: Node, t: Node): [string, Point[] | undefined] => {
    const sx = centerX(s.box);
    const tx = centerX(t.box);
    if (t.row === undefined) {
      // VPC 外（上）へ向かう
      const style = "exitX=0.5;exitY=0;entryX=0.5;entryY=1;";
      if (sx === tx) {
        return [style, undefined];
      }
      return [
        style,
        [
          [sx, EXTERNAL_LANE_Y],
          [tx, EXTERNAL_LANE_Y],
        ],
      ];
    }
    if (s.row !== undefined && t.row < s.row) {
      // 上の行へ向かう
      const style = "exitX=0.5;exitY=0;entryX=0.5;entryY=1;";
      if (sx === tx) {
        return [style, undefined];
      }
      const gapY = subnetBox(t.row, 0).y + SUBNET_H + SUBNET_GAP / 2;
      return [
        style,
        [
          [sx, gapY],
          [tx, gapY],
        ],
      ];
    }
    // 下の行へ向かう
    if (sx === tx) {
      return ["", undefined];
    }
    // 上辺の中央は上向きの矢印が使うことがあるため、左寄りに入れる
    const entryX = t.box.x + ICON * 0.25;
    const gapY = subnetBox(t.row, 0).y - SUBNET_GAP / 2;
    return [
      "exitX=0.5;exitY=1;entryX=0.25;entryY=0;",
      [
        [sx, gapY],
        [entryX, gapY],
      ],
    ];
  };

  // 両端が AZ ごとに配置されている場合は同じ AZ 同士だけを結ぶ
  const pair = (sources: Node[], targets: Node[]): [Node, Node][] =>
    sources.flatMap((s) =>
      targets
        .filter((t) => !(sources.length > 1 && targets.length > 1 && s.az !== t.az))
        .map((t): [Node, Node] => [s, t]),
    );

  const diagram = new Diagram();

  // 1. 枠（背面）
  diagram.vertex("region", network.region, REGION_STYLE, region);
  diagram.vertex("vpc", `${network.vpc.label} (${network.vpc.cidr})`, VPC_STYLE, vpc);
  azs.forEach((az, i) => {
    diagram.vertex(`az-${az}`, az, AZ_STYLE, azBoxes[i]!);
    subnets.forEach((subnet, row) => {
      diagram.vertex(
        `subnet-${subnet.id}-${az}`,
        `${subnet.label}\n${subnet.cidrs[i]}`,
        SUBNET_STYLES[subnet.type],
        subnetBox(row, i),
      );
    });
  });

  // 2. 通信（枠とアイコンの間）
  for (const comm of data.communications) {
    const sources = nodes.get(comm.source)!;
    let targets = nodes.get(comm.destination)!;
    // primary_standby への通信は Primary にのみ向ける
    if (resources[comm.destination]!.layout === "primary_standby") {
      targets = targets.slice(0, 1);
    }

    const label = `${comm.protocol.toUpperCase()} ${comm.port}`;
    let legs: [Node, Node, string, number][];

    if (comm.via !== undefined) {
      // source -> via にラベルを付け、via -> destination はラベルなしで描く。
      // ラベルは via 寄りに置き、行間を通る他の矢印と重ならないようにする
      const viaNodes = nodes.get(comm.via)!;
      legs = pair(sources, viaNodes).map(([s, v]) => [s, v, label, 0.5]);
      const usedVias = viaNodes.filter((v) => legs.some((leg) => leg[1] === v));
      legs.push(...pair(usedVias, targets).map(([v, t]): [Node, Node, string, number] => [v, t, "", 0]));
    } else {
      // VPC 外からの通信は Internet Gateway と重ならないよう、ラベルを始点寄りにする
      const labelPos = resources[comm.source]!.subnet === undefined ? -0.6 : 0;
      legs = pair(sources, targets).map(([s, t]) => [s, t, label, labelPos]);
    }

    for (const [s, t, legLabel, labelPos] of legs) {
      const [style, points] = route(s, t);
      diagram.edge(
        `communication-${comm.id}-${s.cellId}-${t.cellId}`,
        legLabel,
        EDGE_STYLE + style,
        s.cellId,
        t.cellId,
        labelPos,
        points,
      );
    }
  }

  // Multi-AZ のレプリケーション（通信要件ではなく AWS 管理の通信のため、点線で示す）
  for (const [resourceId, resource] of Object.entries(resources)) {
    if (resource.layout !== "primary_standby") {
      continue;
    }
    const [primary, standby] = nodes.get(resourceId) as [Node, Node];
    const dropY = primary.box.y + ICON + REPLICATION_DROP;
    diagram.edge(
      `replication-${resourceId}`,
      "Synchronous replication",
      REPLICATION_STYLE + "exitX=0.5;exitY=1;entryX=0.5;entryY=1;",
      primary.cellId,
      standby.cellId,
      0,
      [
        [centerX(primary.box), dropY],
        [centerX(standby.box), dropY],
      ],
    );
  }

  // 3. アイコン（前面）。Internet Gateway は public サブネットがある場合に VPC の上辺へ置く
  if (subnets.some((subnet) => subnet.type === "public")) {
    diagram.vertex("internet-gateway", "Internet gateway", IGW_STYLE, {
      x: centerX(vpc) - ICON / 2,
      y: vpc.y - ICON / 2,
      w: ICON,
      h: ICON,
    });
  }
  for (const resourceNodes of nodes.values()) {
    for (const node of resourceNodes) {
      diagram.vertex(node.cellId, node.label, node.style, node.box);
    }
  }

  return diagram.toXml();
}
