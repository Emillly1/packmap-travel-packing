import type {
  BagNode,
  CompartmentNode,
  ContainerTransport,
  DepartureCheck,
  ItemAccess,
  ItemNode,
  LuggageNode,
  PackingWarning,
  Recommendation,
  TransportRule,
} from "../models/packing";
import { CURRENT_SCHEMA_VERSION, type PackMapDocument } from "../models/schema";
import type { LaundryFrequency, TransportMode, Trip, TripType } from "../models/trip";

export interface ImportResult {
  document: PackMapDocument;
  sourceVersion: string;
  migrated: boolean;
}

export class PackMapImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PackMapImportError";
  }
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new PackMapImportError(`${label}缺少有效文本。`);
  return value;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === "string");
  if (typeof value === "string") return value.split(/[、,，;；\n]/).map((entry) => entry.trim()).filter(Boolean);
  return [];
}

function validateTransport(value: unknown): ContainerTransport {
  if (value === "carry-on" || value === "checked" || value === "none") return value;
  throw new PackMapImportError("发现无效的箱包运输角色。");
}

function validateItem(value: unknown, ids: Set<string>): ItemNode {
  if (!isRecord(value) || value.type !== "item") throw new PackMapImportError("物品节点格式无效。");
  const id = requiredString(value.id, "物品 ID");
  if (ids.has(id)) throw new PackMapImportError(`节点 ID 重复：${id}`);
  ids.add(id);
  if (typeof value.packed !== "boolean") throw new PackMapImportError(`物品“${stringValue(value.name, id)}”缺少装入状态。`);
  const transportRule = validateTransport(value.transportRule);
  const accessValues: ItemAccess[] = ["airport", "daily", "first-night", "later", "any"];
  const recommendationValues: Recommendation[] = ["bring", "buy-local", "optional", "skip"];
  if (!accessValues.includes(value.access as ItemAccess)) throw new PackMapImportError(`物品“${stringValue(value.name, id)}”的取用阶段无效。`);
  if (!recommendationValues.includes(value.recommendation as Recommendation)) throw new PackMapImportError(`物品“${stringValue(value.name, id)}”的建议类型无效。`);
  return {
    id,
    type: "item",
    name: requiredString(value.name, "物品名称"),
    quantity: requiredString(value.quantity, "物品数量"),
    category: requiredString(value.category, "物品分类"),
    packed: value.packed,
    transportRule,
    access: value.access as ItemAccess,
    recommendation: value.recommendation as Recommendation,
    stageIds: stringArray(value.stageIds),
    risk: typeof value.risk === "string" ? value.risk : undefined,
    reason: typeof value.reason === "string" ? value.reason : undefined,
    notes: typeof value.notes === "string" ? value.notes : undefined,
  };
}

function validateBag(value: unknown, ids: Set<string>): BagNode {
  if (!isRecord(value) || value.type !== "bag" || !Array.isArray(value.children)) throw new PackMapImportError("收纳袋节点格式无效。");
  const id = requiredString(value.id, "收纳袋 ID");
  if (ids.has(id)) throw new PackMapImportError(`节点 ID 重复：${id}`);
  ids.add(id);
  return {
    id,
    type: "bag",
    name: requiredString(value.name, "收纳袋名称"),
    children: value.children.map((child) => isRecord(child) && child.type === "bag" ? validateBag(child, ids) : validateItem(child, ids)),
  };
}

function validateCompartment(value: unknown, ids: Set<string>): CompartmentNode {
  if (!isRecord(value) || value.type !== "compartment" || !Array.isArray(value.children)) throw new PackMapImportError("分区节点格式无效。");
  const id = requiredString(value.id, "分区 ID");
  if (ids.has(id)) throw new PackMapImportError(`节点 ID 重复：${id}`);
  ids.add(id);
  return {
    id,
    type: "compartment",
    name: requiredString(value.name, "分区名称"),
    children: value.children.map((child) => isRecord(child) && child.type === "bag" ? validateBag(child, ids) : validateItem(child, ids)),
  };
}

function validateLuggage(value: unknown, ids: Set<string>): LuggageNode {
  if (!isRecord(value) || value.type !== "luggage" || !Array.isArray(value.children)) throw new PackMapImportError("箱包节点格式无效。");
  const id = requiredString(value.id, "箱包 ID");
  if (ids.has(id)) throw new PackMapImportError(`节点 ID 重复：${id}`);
  ids.add(id);
  return {
    id,
    type: "luggage",
    name: requiredString(value.name, "箱包名称"),
    transport: validateTransport(value.transport),
    children: value.children.map((child) => validateCompartment(child, ids)),
  };
}

function validateTrip(value: unknown): Trip {
  if (!isRecord(value)) throw new PackMapImportError("旅行资料格式无效。");
  const tripTypes: TripType[] = ["leisure", "study", "business", "outdoor"];
  const laundryValues: LaundryFrequency[] = ["often", "weekly", "rare"];
  const transportValues: TransportMode[] = ["plane", "train", "car", "ferry"];
  if (!tripTypes.includes(value.tripType as TripType)) throw new PackMapImportError("旅行类型无效。");
  if (!laundryValues.includes(value.laundryFrequency as LaundryFrequency)) throw new PackMapImportError("洗衣频率无效。");
  const transportModes = stringArray(value.transportModes);
  if (transportModes.some((mode) => !transportValues.includes(mode as TransportMode))) throw new PackMapImportError("交通方式无效。");
  const travelers = Number(value.travelers);
  if (!Number.isInteger(travelers) || travelers < 1) throw new PackMapImportError("旅行人数无效。");
  return {
    name: requiredString(value.name, "旅行名称"),
    origin: requiredString(value.origin, "出发地"),
    destinations: stringArray(value.destinations),
    startDate: requiredString(value.startDate, "出发日期"),
    endDate: requiredString(value.endDate, "返回日期"),
    travelers,
    tripType: value.tripType as TripType,
    laundryFrequency: value.laundryFrequency as LaundryFrequency,
    transportModes: transportModes as TransportMode[],
    transportNotes: stringValue(value.transportNotes),
    specialNeeds: stringValue(value.specialNeeds),
    bagSetup: requiredString(value.bagSetup, "箱包结构"),
    stages: Array.isArray(value.stages) ? value.stages as Trip["stages"] : [],
  };
}

function validateWarnings(value: unknown): PackingWarning[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new PackMapImportError("安全提醒格式无效。");
  return value.map((warning) => {
    if (!isRecord(warning)) throw new PackMapImportError("安全提醒格式无效。");
    const severity = warning.severity;
    if (severity !== "low" && severity !== "medium" && severity !== "high") throw new PackMapImportError("安全提醒等级无效。");
    return {
      id: requiredString(warning.id, "提醒 ID"),
      itemId: typeof warning.itemId === "string" ? warning.itemId : undefined,
      itemName: typeof warning.itemName === "string" ? warning.itemName : undefined,
      issue: requiredString(warning.issue, "提醒内容"),
      suggestedAction: typeof warning.suggestedAction === "string" ? warning.suggestedAction : undefined,
      severity,
      acknowledged: Boolean(warning.acknowledged),
    };
  });
}

function validateChecks(value: unknown): DepartureCheck[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new PackMapImportError("出发清单格式无效。");
  return value.map((check) => {
    if (!isRecord(check)) throw new PackMapImportError("出发清单格式无效。");
    const groups: Array<NonNullable<DepartureCheck["group"]>> = ["carry", "documents", "transport", "arrival", "home"];
    return {
      id: requiredString(check.id, "检查项 ID"),
      name: requiredString(check.name, "检查项名称"),
      checked: Boolean(check.checked),
      group: groups.includes(check.group as NonNullable<DepartureCheck["group"]>) ? check.group as DepartureCheck["group"] : undefined,
    };
  });
}

export function validatePackMapDocument(value: unknown): PackMapDocument {
  if (!isRecord(value) || value.schemaVersion !== CURRENT_SCHEMA_VERSION) throw new PackMapImportError("不是受支持的 PackMap 2.0.0 文件。");
  if (!Array.isArray(value.containers)) throw new PackMapImportError("文件缺少箱包目录。");
  const ids = new Set<string>();
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: requiredString(value.id, "旅行 ID"),
    createdAt: requiredString(value.createdAt, "创建时间"),
    updatedAt: requiredString(value.updatedAt, "更新时间"),
    trip: validateTrip(value.trip),
    containers: value.containers.map((container) => validateLuggage(container, ids)),
    departureChecks: validateChecks(value.departureChecks),
    warnings: validateWarnings(value.warnings),
    metadata: isRecord(value.metadata) ? structuredClone(value.metadata) : undefined,
  };
}

function legacyTransport(value: unknown): ContainerTransport {
  if (value === "carry_on" || value === "carry-on" || value === "cabin" || value === "随身") return "carry-on";
  if (value === "checked" || value === "luggage" || value === "托运") return "checked";
  return "none";
}

function legacyNodeIdFactory() {
  const ids = new Set<string>();
  return (value: unknown, prefix: string): string => {
    const base = typeof value === "string" && value.trim() ? value.trim() : `${prefix}-${ids.size + 1}`;
    let id = base;
    let suffix = 2;
    while (ids.has(id)) id = `${base}-${suffix++}`;
    ids.add(id);
    return id;
  };
}

function legacyChildren(value: UnknownRecord): unknown[] {
  const children = value.children ?? value.items ?? value.bags ?? value.contents;
  return Array.isArray(children) ? children : [];
}

function migrateLegacyItem(value: unknown, nextId: ReturnType<typeof legacyNodeIdFactory>): ItemNode {
  if (!isRecord(value)) throw new PackMapImportError("旧版物品格式无效。");
  return {
    id: nextId(value.id ?? value.item_id, "item"),
    type: "item",
    name: requiredString(value.name ?? value.item_name, "旧版物品名称"),
    quantity: stringValue(value.quantity ?? value.qty, "1 件") || "1 件",
    category: stringValue(value.category, "custom") || "custom",
    packed: Boolean(value.packed ?? value.checked),
    transportRule: legacyTransport(value.transportRule ?? value.transport_rule) as TransportRule,
    access: ["airport", "daily", "first-night", "later", "any"].includes(String(value.access)) ? value.access as ItemAccess : "any",
    recommendation: ["bring", "buy-local", "optional", "skip"].includes(String(value.recommendation)) ? value.recommendation as Recommendation : "bring",
    stageIds: stringArray(value.stageIds ?? value.stage_ids),
    risk: typeof value.risk === "string" ? value.risk : undefined,
    reason: typeof value.reason === "string" ? value.reason : undefined,
    notes: typeof value.notes === "string" ? value.notes : undefined,
  };
}

function migrateLegacyBag(value: UnknownRecord, nextId: ReturnType<typeof legacyNodeIdFactory>): BagNode {
  return {
    id: nextId(value.id ?? value.bag_id, "bag"),
    type: "bag",
    name: requiredString(value.name ?? value.bag_name, "旧版收纳袋名称"),
    children: legacyChildren(value).map((child) => isRecord(child) && (child.type === "bag" || Array.isArray(child.children))
      ? migrateLegacyBag(child, nextId)
      : migrateLegacyItem(child, nextId)),
  };
}

function migrateLegacyCompartment(value: unknown, nextId: ReturnType<typeof legacyNodeIdFactory>): CompartmentNode {
  if (!isRecord(value)) throw new PackMapImportError("旧版分区格式无效。");
  return {
    id: nextId(value.id ?? value.compartment_id, "compartment"),
    type: "compartment",
    name: requiredString(value.name ?? value.compartment_name, "旧版分区名称"),
    children: legacyChildren(value).map((child) => isRecord(child) && (child.type === "bag" || Array.isArray(child.children))
      ? migrateLegacyBag(child, nextId)
      : migrateLegacyItem(child, nextId)),
  };
}

function migrateLegacyLuggage(value: unknown, nextId: ReturnType<typeof legacyNodeIdFactory>): LuggageNode {
  if (!isRecord(value)) throw new PackMapImportError("旧版箱包格式无效。");
  const rawCompartments = value.children ?? value.compartments ?? value.areas;
  const compartments = Array.isArray(rawCompartments) ? rawCompartments : [];
  return {
    id: nextId(value.id ?? value.luggage_id, "luggage"),
    type: "luggage",
    name: requiredString(value.name ?? value.luggage_name, "旧版箱包名称"),
    transport: legacyTransport(value.transport ?? value.transport_rule),
    children: compartments.map((child) => migrateLegacyCompartment(child, nextId)),
  };
}

function migrateLegacyTrip(source: UnknownRecord): Trip {
  const trip = isRecord(source.trip) ? source.trip : source;
  const transportModes = stringArray(trip.transportModes ?? trip.transport_modes).filter((mode) => ["plane", "train", "car", "ferry"].includes(mode)) as TransportMode[];
  return {
    name: stringValue(trip.name ?? trip.trip_name ?? trip.title, "导入的旅行"),
    origin: stringValue(trip.origin, "未填写"),
    destinations: stringArray(trip.destinations ?? trip.destination),
    startDate: stringValue(trip.startDate ?? trip.start_date, "1970-01-01"),
    endDate: stringValue(trip.endDate ?? trip.end_date, "1970-01-01"),
    travelers: Math.max(1, Number(trip.travelers ?? trip.people ?? 1) || 1),
    tripType: ["leisure", "study", "business", "outdoor"].includes(String(trip.tripType ?? trip.trip_type)) ? (trip.tripType ?? trip.trip_type) as TripType : "leisure",
    laundryFrequency: ["often", "weekly", "rare"].includes(String(trip.laundryFrequency ?? trip.laundry_frequency)) ? (trip.laundryFrequency ?? trip.laundry_frequency) as LaundryFrequency : "weekly",
    transportModes,
    transportNotes: stringValue(trip.transportNotes ?? trip.transport_notes),
    specialNeeds: stringValue(trip.specialNeeds ?? trip.special_needs),
    bagSetup: stringValue(trip.bagSetup ?? trip.bag_setup, "导入箱包：主区域"),
    stages: [],
  };
}

export function migrateLegacyDocument(value: unknown): PackMapDocument {
  if (!isRecord(value)) throw new PackMapImportError("旧版文件不是有效对象。");
  const source = isRecord(value.packmap) ? value.packmap : value;
  const version = source.schema_version ?? source.schemaVersion;
  if (version !== "1.0") throw new PackMapImportError("不是受支持的 PackMap 1.0 文件。");
  const rawContainers = source.containers ?? source.luggage ?? source.luggages;
  if (!Array.isArray(rawContainers)) throw new PackMapImportError("旧版文件缺少箱包目录。");
  const nextId = legacyNodeIdFactory();
  const known = new Set(["schema_version", "schemaVersion", "trip", "containers", "luggage", "luggages", "departure_checks", "warnings", "id", "created_at", "updated_at"]);
  const unknown = Object.fromEntries(Object.entries(source).filter(([key]) => !known.has(key)));
  const now = new Date().toISOString();
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: stringValue(source.id, `trip-import-${Date.now().toString(36)}`),
    createdAt: stringValue(source.created_at, now),
    updatedAt: now,
    trip: migrateLegacyTrip(source),
    containers: rawContainers.map((container) => migrateLegacyLuggage(container, nextId)),
    departureChecks: validateChecks(source.departure_checks),
    warnings: validateWarnings(source.warnings),
    metadata: { migratedFrom: "1.0", legacyUnknown: unknown },
  };
}

export function serializeDocumentJson(document: PackMapDocument): string {
  return JSON.stringify(document, null, 2);
}

function renderTextNode(node: BagNode | ItemNode, depth: number, lines: string[]): void {
  const indent = "  ".repeat(depth);
  if (node.type === "item") {
    lines.push(`${indent}${node.packed ? "[已装]" : "[未装]"} ${node.name} · ${node.quantity}`);
    return;
  }
  lines.push(`${indent}收纳袋：${node.name}`);
  node.children.forEach((child) => renderTextNode(child, depth + 1, lines));
}

export function serializeDocumentText(document: PackMapDocument): string {
  const lines = [
    "PACKMAP 2.0.0",
    `旅行：${document.trip.name}`,
    `路线：${document.trip.origin} → ${document.trip.destinations.join("、")}`,
    `日期：${document.trip.startDate} 至 ${document.trip.endDate}`,
    "",
  ];
  document.containers.forEach((luggage) => {
    lines.push(`箱包：${luggage.name} [${luggage.transport}]`);
    luggage.children.forEach((compartment) => {
      lines.push(`  分区：${compartment.name}`);
      compartment.children.forEach((child) => renderTextNode(child, 2, lines));
    });
  });
  lines.push("", "安全提醒：");
  document.warnings.forEach((warning) => lines.push(`- ${warning.acknowledged ? "[已知悉]" : "[待处理]"} ${warning.itemName ?? "行程"}：${warning.issue}`));
  lines.push("", "出发清单：");
  document.departureChecks.forEach((check) => lines.push(`- ${check.checked ? "[完成]" : "[待办]"} ${check.name}`));
  lines.push("", `# PACKMAP_DATA ${encodeURIComponent(JSON.stringify(document))}`);
  return lines.join("\n");
}

export function importPackMapText(sourceText: string): ImportResult {
  const text = sourceText.trim();
  if (!text) throw new PackMapImportError("导入内容为空。");
  let value: unknown;
  if (text.startsWith("PACKMAP ")) {
    const payload = text.split("\n").find((line) => line.startsWith("# PACKMAP_DATA "))?.slice("# PACKMAP_DATA ".length);
    if (!payload) throw new PackMapImportError("TXT 文件缺少可恢复的数据段。");
    try {
      value = JSON.parse(decodeURIComponent(payload));
    } catch {
      throw new PackMapImportError("TXT 文件的数据段已损坏。");
    }
  } else {
    try {
      value = JSON.parse(text);
    } catch {
      throw new PackMapImportError("文件不是有效的 JSON 或 PackMap TXT。");
    }
  }
  const record = isRecord(value) ? value : null;
  const version = record?.schemaVersion ?? record?.schema_version ?? (isRecord(record?.packmap) ? record.packmap.schema_version : undefined);
  if (version === CURRENT_SCHEMA_VERSION) return { document: validatePackMapDocument(value), sourceVersion: CURRENT_SCHEMA_VERSION, migrated: false };
  if (version === "1.0") return { document: migrateLegacyDocument(value), sourceVersion: "1.0", migrated: true };
  throw new PackMapImportError(`不支持的 PackMap 版本：${String(version ?? "未知")}`);
}
