import { ITEM_CATALOG } from "../data/itemCatalog";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type CandidateGroup,
  type CandidateItem,
  type CatalogItem,
  type PackingCategory,
  type PlannerTrigger,
  type PlanningResult,
  type QuantityRule,
} from "../models/planning";
import type { TransportRule } from "../models/packing";
import type { TripDraft } from "../models/trip";
import { parseDestinations, tripDurationDays } from "./trip";

interface PlanningContext {
  totalDays: number;
  laundryCycleDays: number;
  travelers: number;
  triggers: Set<PlannerTrigger>;
}

function laundryCycleDays(draft: TripDraft): number {
  if (draft.laundryFrequency === "often") return 5;
  if (draft.laundryFrequency === "rare") return 10;
  return 7;
}

function normalizedTripText(draft: TripDraft): string {
  return [draft.name, draft.destinationsText, draft.specialNeeds, draft.transportNotes]
    .join(" ")
    .toLocaleLowerCase("zh-CN");
}

function buildPlanningContext(draft: TripDraft): PlanningContext {
  const totalDays = Math.max(1, tripDurationDays(draft.startDate, draft.endDate));
  const destinations = parseDestinations(draft.destinationsText);
  const text = normalizedTripText(draft);
  const excludesOutdoor = /不(?:需要|会|去)?徒步|不登山|不户外|无徒步|没有徒步/.test(text);
  const positiveActivityText = text.replace(/不(?:需要|会|去)?徒步|不登山|不户外|无徒步|没有徒步/g, "");
  const triggers = new Set<PlannerTrigger>(["always"]);

  draft.transportModes.forEach((mode) => triggers.add(mode));
  if (draft.tripType === "study") triggers.add("study");
  if (draft.tripType === "business") triggers.add("business");
  if (!excludesOutdoor && (draft.tripType === "outdoor" || /徒步|登山|户外|露营|滑雪/.test(positiveActivityText))) triggers.add("outdoor");
  if (/拍照|摄影|化妆|全妆|正式|典礼|婚礼|晚宴/.test(text) || draft.tripType === "business") triggers.add("photo");
  if (/游泳|泳池|海边|沙滩|温泉|浮潜/.test(text)) triggers.add("swim");
  if (/冬|雪|寒|冷|冰岛|北欧|爱丁堡|滑雪/.test(text)) triggers.add("cold");
  if (/敏感|过敏|干皮|起皮|痘|湿疹|药|医疗|隐形|ok镜/.test(text)) triggers.add("sensitive-care");
  if (/儿童|孩子|婴儿|宝宝|幼儿/.test(text)) triggers.add("children");
  if (totalDays >= 21) triggers.add("long-trip");
  if (destinations.length > 1) triggers.add("multi-city");

  return {
    totalDays,
    laundryCycleDays: laundryCycleDays(draft),
    travelers: Math.max(1, draft.travelers),
    triggers,
  };
}

function perPerson(value: string, travelers: number): string {
  return travelers > 1 ? `${value} × ${travelers} 人` : value;
}

function quantityFor(rule: QuantityRule, item: CatalogItem, context: PlanningContext): string {
  const { totalDays, laundryCycleDays: cycle, travelers } = context;
  switch (rule) {
    case "one-shared":
      return `1 ${item.unit}`;
    case "one-person":
      return perPerson(`1 ${item.unit}`, travelers);
    case "tops": {
      const count = Math.max(2, Math.min(totalDays, cycle));
      return perPerson(`${count} ${item.unit}`, travelers);
    }
    case "underwear":
    case "socks": {
      const count = Math.max(3, Math.min(totalDays + 1, cycle + 2));
      return perPerson(`${count} ${item.unit}`, travelers);
    }
    case "bottoms": {
      const count = Math.min(4, Math.max(2, Math.ceil(Math.min(totalDays, cycle) / 3)));
      return perPerson(`${count} ${item.unit}`, travelers);
    }
    case "sleepwear":
      return perPerson(`${totalDays >= 14 ? 2 : 1} ${item.unit}`, travelers);
    case "three-day-supply":
      return perPerson("至少 3 天量", travelers);
    case "first-two-washes":
      return "前 2 次用量";
    case "shopping-buffer":
      return "至少 20%";
  }
}

function reasonFor(item: CatalogItem, context: PlanningContext): string {
  if (["tops", "underwear", "socks", "bottoms"].includes(item.quantityRule)) {
    return `${item.reason}；当前按 ${context.laundryCycleDays} 天洗衣周期计算`;
  }
  return item.reason;
}

function matchedTriggers(item: CatalogItem, context: PlanningContext): PlannerTrigger[] {
  return item.triggers.filter((trigger) => context.triggers.has(trigger));
}

function fingerprintFor(draft: TripDraft): string {
  return [
    draft.origin.trim(),
    draft.destinationsText.trim(),
    draft.startDate,
    draft.endDate,
    String(draft.travelers),
    draft.tripType,
    draft.laundryFrequency,
    [...draft.transportModes].sort().join(","),
    draft.transportNotes.trim(),
    draft.specialNeeds.trim(),
  ].join("|");
}

export function generatePackingSuggestions(draft: TripDraft): PlanningResult {
  const context = buildPlanningContext(draft);
  const candidates: CandidateItem[] = ITEM_CATALOG.flatMap((item) => {
    const sourceTriggers = matchedTriggers(item, context);
    if (sourceTriggers.length === 0) return [];
    return [{
      id: item.id,
      name: item.name,
      category: item.category,
      scope: item.scope,
      quantity: quantityFor(item.quantityRule, item, context),
      transportRule: item.transportRule,
      access: item.access,
      recommendation: item.recommendation,
      reason: reasonFor(item, context),
      selected: item.defaultSelected ?? (item.recommendation !== "optional" && item.recommendation !== "skip"),
      sourceTriggers,
    }];
  });

  const groups: CandidateGroup[] = CATEGORY_ORDER.flatMap((category) => {
    const items = candidates.filter((item) => item.category === category);
    return items.length ? [{ id: category, name: CATEGORY_LABELS[category], items }] : [];
  });

  return {
    fingerprint: fingerprintFor(draft),
    totalDays: context.totalDays,
    laundryCycleDays: context.laundryCycleDays,
    travelers: context.travelers,
    groups,
  };
}

export function reconcilePlanningSelections(next: PlanningResult, previous: PlanningResult | null): PlanningResult {
  if (!previous) return next;
  const previousItems = flattenCandidateItems(previous);
  const selectedById = new Map(previousItems.map((item) => [item.id, item.selected]));
  const customItems = previousItems.filter((item) => item.custom);
  return {
    ...next,
    groups: CATEGORY_ORDER.flatMap((category) => {
      const generated = next.groups.find((group) => group.id === category)?.items ?? [];
      const custom = customItems.filter((item) => item.category === category);
      const items = [...generated, ...custom].map((item) => ({
        ...item,
        selected: selectedById.get(item.id) ?? item.selected,
      }));
      return items.length ? [{ id: category, name: CATEGORY_LABELS[category], items }] : [];
    }),
  };
}

export interface CustomCandidateInput {
  name: string;
  quantity: string;
  category: PackingCategory;
  transportRule: TransportRule;
}

export function addCustomCandidate(result: PlanningResult, input: CustomCandidateInput): PlanningResult {
  const name = input.name.trim();
  if (!name) return result;
  const existingIds = new Set(flattenCandidateItems(result).map((item) => item.id));
  let index = existingIds.size + 1;
  let id = `custom-candidate-${index}`;
  while (existingIds.has(id)) id = `custom-candidate-${++index}`;
  const item: CandidateItem = {
    id,
    name,
    category: input.category,
    scope: "shared",
    quantity: input.quantity.trim() || "1 件",
    transportRule: input.transportRule,
    access: input.transportRule === "carry-on" ? "daily" : input.transportRule === "checked" ? "later" : "any",
    recommendation: "bring",
    reason: "你添加的自定义物品。",
    selected: true,
    sourceTriggers: [],
    custom: true,
  };
  const hasGroup = result.groups.some((group) => group.id === input.category);
  const groups = hasGroup
    ? result.groups.map((group) => group.id === input.category ? { ...group, items: [...group.items, item] } : group)
    : [...result.groups, { id: input.category, name: CATEGORY_LABELS[input.category], items: [item] }]
        .sort((left, right) => CATEGORY_ORDER.indexOf(left.id) - CATEGORY_ORDER.indexOf(right.id));
  return { ...result, groups };
}

export function flattenCandidateItems(result: PlanningResult): CandidateItem[] {
  return result.groups.flatMap((group) => group.items);
}

export function countSelectedCandidates(result: PlanningResult): number {
  return flattenCandidateItems(result).filter((item) => item.selected).length;
}
