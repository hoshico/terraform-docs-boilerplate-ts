/**
 * 通信要件 YAML の読み込みと検証。
 *
 * 1. YAML の構文チェック（キーの重複も検出する）
 * 2. JSON Schema（requirements/communication.schema.json）による構造チェック
 * 3. JSON Schema では検証しにくい整合性チェック
 *    - 通信 ID・サブネット ID の重複
 *    - 未定義の source / destination / via / subnet
 *    - VPC 外のリソースを via に指定している
 *    - source と destination が同一の通信
 *    - サブネットの cidrs の数と AZ の数の不一致
 *    - layout とサブネット・AZ 数の組み合わせ
 */

import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import { parseDocument } from "yaml";
import schema from "../../requirements/communication.schema.json" with { type: "json" };
import { REQUIREMENTS_PATH } from "./paths.ts";

export type Layout = "single" | "span" | "per_az" | "primary_standby";

export interface Subnet {
  id: string;
  label: string;
  type: "public" | "private";
  cidrs: string[];
}

export interface Resource {
  type: string;
  label: string;
  subnet?: string;
  layout?: Layout;
}

export interface Communication {
  id: string;
  source: string;
  destination: string;
  via?: string;
  protocol: "tcp" | "udp";
  port: number;
  description: string;
}

export interface CommunicationRequirements {
  network: {
    region: string;
    vpc: { label: string; cidr: string };
    availability_zones: string[];
    subnets: Subnet[];
  };
  resources: Record<string, Resource>;
  communications: Communication[];
}

export type LoadResult =
  | { ok: true; data: CommunicationRequirements }
  | { ok: false; errors: string[] };

const ajv = new Ajv2020({ allErrors: true });
const validateSchema = ajv.compile<CommunicationRequirements>(schema);

function validateNetwork(data: CommunicationRequirements): string[] {
  const errors: string[] = [];
  const network = data.network;
  const azCount = network.availability_zones.length;
  const subnetIds = new Set<string>();

  for (const subnet of network.subnets) {
    if (subnetIds.has(subnet.id)) {
      errors.push(`subnet ${subnet.id}: サブネット ID が重複しています`);
    }
    subnetIds.add(subnet.id);

    if (subnet.cidrs.length !== azCount) {
      errors.push(
        `subnet ${subnet.id}: cidrs の数（${subnet.cidrs.length}）が` +
          ` availability_zones の数（${azCount}）と一致しません`,
      );
    }
  }

  for (const [resourceId, resource] of Object.entries(data.resources)) {
    const layout = resource.layout ?? "single";
    const subnet = resource.subnet;

    if (subnet !== undefined && !subnetIds.has(subnet)) {
      errors.push(`resource ${resourceId}: subnet '${subnet}' が network.subnets に定義されていません`);
    }
    if (subnet === undefined && resource.layout !== undefined) {
      errors.push(`resource ${resourceId}: layout を指定する場合は subnet が必要です`);
    }
    if (layout === "primary_standby" && azCount < 2) {
      errors.push(`resource ${resourceId}: primary_standby には 2 つ以上の AZ が必要です`);
    }
  }

  return errors;
}

function validateCommunications(data: CommunicationRequirements): string[] {
  const errors: string[] = [];
  const resources = data.resources;
  const seenIds = new Set<string>();

  for (const comm of data.communications) {
    if (seenIds.has(comm.id)) {
      errors.push(`${comm.id}: 通信 ID が重複しています`);
    }
    seenIds.add(comm.id);

    for (const key of ["source", "destination"] as const) {
      if (!Object.hasOwn(resources, comm[key])) {
        errors.push(`${comm.id}: ${key} '${comm[key]}' が resources に定義されていません`);
      }
    }

    if (comm.source === comm.destination) {
      errors.push(`${comm.id}: source と destination が同じです`);
    }

    const via = comm.via;
    if (via !== undefined) {
      if (!Object.hasOwn(resources, via)) {
        errors.push(`${comm.id}: via '${via}' が resources に定義されていません`);
      } else if (resources[via]?.subnet === undefined) {
        errors.push(`${comm.id}: via '${via}' は VPC 内（subnet を持つ）リソースである必要があります`);
      }
      if (via === comm.source || via === comm.destination) {
        errors.push(`${comm.id}: via に source / destination と同じリソースは指定できません`);
      }
    }
  }

  return errors;
}

/** JSON Schema を満たすデータに対する整合性チェック。エラーがなければ空配列を返す。 */
export function validateConsistency(data: CommunicationRequirements): string[] {
  return [...validateNetwork(data), ...validateCommunications(data)];
}

/** YAML 文字列を解析し、スキーマ検証と整合性チェックを行う。 */
export function parseCommunication(text: string): LoadResult {
  const doc = parseDocument(text);
  if (doc.errors.length > 0) {
    return { ok: false, errors: doc.errors.map((e) => `YAML: ${e.message}`) };
  }

  const value: unknown = doc.toJS();
  if (!validateSchema(value)) {
    const errors = (validateSchema.errors ?? []).map((e) => {
      const detail = e.keyword === "additionalProperties" ? ` (${e.params.additionalProperty})` : "";
      return `schema: ${e.instancePath || "/"} ${e.message}${detail}`;
    });
    return { ok: false, errors };
  }

  const errors = validateConsistency(value);
  return errors.length > 0 ? { ok: false, errors } : { ok: true, data: value };
}

export function loadCommunication(path: string = REQUIREMENTS_PATH): LoadResult {
  return parseCommunication(readFileSync(path, "utf-8"));
}

/** 生成スクリプト用。検証に失敗した場合はエラーを出力して終了する。 */
export function loadCommunicationOrExit(path: string = REQUIREMENTS_PATH): CommunicationRequirements {
  const result = loadCommunication(path);
  if (!result.ok) {
    for (const error of result.errors) {
      console.error(`ERROR: ${error}`);
    }
    process.exit(1);
  }
  return result.data;
}
