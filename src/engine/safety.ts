import { findMapEntry, flattenMap } from "./packingMap";
import type { DepartureCheck, ItemNode, LuggageNode, PackingWarning } from "../models/packing";
import type { PackMapDocument } from "../models/schema";

interface ItemLocation {
  item: ItemNode;
  luggage: LuggageNode;
  path: string[];
}

interface WarningRule {
  id: string;
  matches(item: ItemNode): boolean;
  applies(location: ItemLocation): boolean;
  severity: PackingWarning["severity"];
  issue: string;
  action: string;
}

const WARNING_RULES: WarningRule[] = [
  {
    id: "battery-checked",
    matches: (item) => /充电宝|移动电源|备用电池|锂电池|power\s?bank/i.test(`${item.name} ${item.notes ?? ""}`),
    applies: ({ luggage }) => luggage.transport === "checked",
    severity: "high",
    issue: "含锂电池的设备被放在托运行李中。",
    action: "移至随身行李，并在出发前核对航空公司容量与标识要求。",
  },
  {
    id: "blade-carry-on",
    matches: (item) => /瑞士军刀|军刀|小刀|剪刀|刀片|剃毛刀|刮毛刀|多功能刀/i.test(`${item.name} ${item.notes ?? ""}`),
    applies: ({ luggage }) => luggage.transport === "carry-on",
    severity: "high",
    issue: "刀具或锐器位于随身行李中，可能无法通过安检。",
    action: "优先移至托运行李；具体尺寸和类型仍需核对机场及承运人规则。",
  },
  {
    id: "large-liquid-carry-on",
    matches: (item) => {
      const amounts = [...`${item.name} ${item.quantity} ${item.notes ?? ""}`.matchAll(/(\d+(?:\.\d+)?)\s*(?:ml|毫升)/gi)];
      return amounts.some((match) => Number(match[1]) > 100);
    },
    applies: ({ luggage }) => luggage.transport === "carry-on",
    severity: "medium",
    issue: "标注超过 100ml 的液体位于随身行李中。",
    action: "改放托运行李或换成合规分装，并核对出发机场的液体规定。",
  },
  {
    id: "valuable-checked",
    matches: (item) => /护照|身份证|钱包|现金|银行卡|电脑|平板|手机|相机|首饰|珠宝|手表|贵重/i.test(`${item.name} ${item.notes ?? ""}`),
    applies: ({ luggage }) => luggage.transport === "checked",
    severity: "high",
    issue: "证件或贵重物品被放在托运行李中。",
    action: "移至随身行李并由本人保管，重要资料另留离线备份。",
  },
  {
    id: "essential-care-checked",
    matches: (item) => /常用药|处方药|个人必需药物|眼镜|隐形眼镜|OK镜|助听器|医疗设备/i.test(`${item.name} ${item.notes ?? ""}`),
    applies: ({ luggage }) => luggage.transport === "checked",
    severity: "medium",
    issue: "途中必需的药物、视力用品或医疗设备位于托运行李中。",
    action: "准备至少数日用量随身携带，并保留必要处方或设备资料。",
  },
  {
    id: "first-night-checked",
    matches: (item) => item.access === "first-night",
    applies: ({ luggage }) => luggage.transport === "checked",
    severity: "low",
    issue: "第一晚需要的物品位于托运行李中。",
    action: "考虑在随身包保留一份，以应对延误或晚到。",
  },
  {
    id: "carry-rule-mismatch",
    matches: (item) => item.transportRule === "carry-on",
    applies: ({ luggage }) => luggage.transport === "checked",
    severity: "high",
    issue: "物品的随身要求与当前托运行李位置不一致。",
    action: "移至随身箱包，并重新核对承运人规则。",
  },
  {
    id: "checked-rule-mismatch",
    matches: (item) => item.transportRule === "checked",
    applies: ({ luggage }) => luggage.transport === "carry-on",
    severity: "medium",
    issue: "物品的托运建议与当前随身位置不一致。",
    action: "考虑移至托运行李；如需随身携带，请先核对安检规则。",
  },
];

function itemLocations(document: PackMapDocument): ItemLocation[] {
  const entries = flattenMap(document.containers);
  return entries.flatMap((entry) => {
    if (entry.node.type !== "item") return [];
    let parentId = entry.parentId;
    let luggage: LuggageNode | undefined;
    while (parentId) {
      const parent = findMapEntry(document, parentId);
      if (!parent) break;
      if (parent.node.type === "luggage") {
        luggage = parent.node;
        break;
      }
      parentId = parent.parentId;
    }
    return luggage ? [{ item: entry.node, luggage, path: entry.path }] : [];
  });
}

export function generatePackingWarnings(document: PackMapDocument): PackingWarning[] {
  const previous = new Map(document.warnings.map((warning) => [warning.id, warning.acknowledged]));
  const generated: Array<PackingWarning & { ruleId: string }> = itemLocations(document).flatMap((location) => WARNING_RULES.flatMap((rule) => {
    if (!rule.matches(location.item) || !rule.applies(location)) return [];
    const id = `warning-${rule.id}-${location.item.id}`;
    return [{
      id,
      ruleId: rule.id,
      itemId: location.item.id,
      itemName: location.item.name,
      issue: rule.issue,
      suggestedAction: rule.action,
      severity: rule.severity,
      acknowledged: previous.get(id) ?? false,
    }];
  }));

  const specificRules = new Map([
    ["carry-rule-mismatch", new Set(["battery-checked", "valuable-checked", "essential-care-checked"])],
    ["checked-rule-mismatch", new Set(["blade-carry-on", "large-liquid-carry-on"])],
  ]);

  return generated
    .filter((warning) => {
      const replacements = specificRules.get(warning.ruleId);
      return !replacements || !generated.some((candidate) =>
        candidate.itemId === warning.itemId && replacements.has(candidate.ruleId));
    })
    .map(({ ruleId: _ruleId, ...warning }) => warning);
}

interface CheckDefinition {
  id: string;
  name: string;
  group: NonNullable<DepartureCheck["group"]>;
  when?: (document: PackMapDocument) => boolean;
}

const CHECK_DEFINITIONS: CheckDefinition[] = [
  { id: "carry-phone", name: "手机", group: "carry" },
  { id: "carry-charger", name: "充电头与手机线", group: "carry" },
  { id: "carry-power-bank", name: "充电宝随身携带", group: "carry", when: (document) => document.trip.transportModes.includes("plane") },
  { id: "carry-essential-medicine", name: "途中必需药物与视力用品", group: "carry" },
  { id: "documents-passport", name: "护照、签证与身份证明", group: "documents" },
  { id: "documents-wallet", name: "钱包、银行卡与少量现金", group: "documents" },
  { id: "documents-offline", name: "住宿地址和紧急联系人离线截图", group: "documents" },
  { id: "transport-boarding", name: "值机、登机牌与航班状态", group: "transport", when: (document) => document.trip.transportModes.includes("plane") },
  { id: "transport-baggage", name: "行李重量、锁和行李牌", group: "transport", when: (document) => document.trip.transportModes.includes("plane") },
  { id: "transport-train", name: "车票、站台与换乘信息", group: "transport", when: (document) => document.trip.transportModes.includes("train") },
  { id: "transport-ferry", name: "船票、舱位与登船信息", group: "transport", when: (document) => document.trip.transportModes.includes("ferry") },
  { id: "transport-driving", name: "驾照、租车与路线资料", group: "transport", when: (document) => document.trip.transportModes.includes("car") },
  { id: "arrival-route", name: "落地交通和住宿入住路线", group: "arrival" },
  { id: "arrival-first-night", name: "第一晚用品容易取用", group: "arrival" },
  { id: "home-keys", name: "家门钥匙", group: "home" },
  { id: "home-windows", name: "门窗关闭，水电与燃气已检查", group: "home" },
  { id: "home-rubbish", name: "垃圾已处理，需断电设备已关闭", group: "home" },
];

export function generateDepartureChecks(document: PackMapDocument): DepartureCheck[] {
  const checked = new Map(document.departureChecks.map((check) => [check.id, check.checked]));
  return CHECK_DEFINITIONS
    .filter((definition) => definition.when?.(document) ?? true)
    .map((definition) => ({
      id: definition.id,
      name: definition.name,
      group: definition.group,
      checked: checked.get(definition.id) ?? false,
    }));
}

export function refreshSafetyData(document: PackMapDocument): PackMapDocument {
  const withWarnings = { ...document, warnings: generatePackingWarnings(document) };
  return { ...withWarnings, departureChecks: generateDepartureChecks(withWarnings), updatedAt: new Date().toISOString() };
}

export function acknowledgeWarning(document: PackMapDocument, warningId: string): PackMapDocument {
  if (!document.warnings.some((warning) => warning.id === warningId)) return document;
  return {
    ...document,
    warnings: document.warnings.map((warning) => warning.id === warningId ? { ...warning, acknowledged: !warning.acknowledged } : warning),
    updatedAt: new Date().toISOString(),
  };
}

export function toggleDepartureCheck(document: PackMapDocument, checkId: string): PackMapDocument {
  if (!document.departureChecks.some((check) => check.id === checkId)) return document;
  return {
    ...document,
    departureChecks: document.departureChecks.map((check) => check.id === checkId ? { ...check, checked: !check.checked } : check),
    updatedAt: new Date().toISOString(),
  };
}
