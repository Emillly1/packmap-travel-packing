import type { ItemAccess, Recommendation, TransportRule } from "./packing";

export type PackingCategory =
  | "documents"
  | "electronics"
  | "clothes"
  | "shoes"
  | "care"
  | "health"
  | "transit"
  | "household";

export type CandidateScope = "personal" | "shared";

export type PlannerTrigger =
  | "always"
  | "plane"
  | "train"
  | "car"
  | "ferry"
  | "study"
  | "business"
  | "outdoor"
  | "photo"
  | "swim"
  | "cold"
  | "sensitive-care"
  | "children"
  | "long-trip"
  | "multi-city";

export type QuantityRule =
  | "one-shared"
  | "one-person"
  | "tops"
  | "underwear"
  | "socks"
  | "bottoms"
  | "sleepwear"
  | "three-day-supply"
  | "first-two-washes"
  | "shopping-buffer";

export interface CatalogItem {
  id: string;
  name: string;
  category: PackingCategory;
  scope: CandidateScope;
  unit: string;
  quantityRule: QuantityRule;
  transportRule: TransportRule;
  access: ItemAccess;
  recommendation: Recommendation;
  triggers: PlannerTrigger[];
  reason: string;
  defaultSelected?: boolean;
}

export interface CandidateItem extends Omit<CatalogItem, "triggers" | "quantityRule" | "unit" | "defaultSelected"> {
  quantity: string;
  selected: boolean;
  sourceTriggers: PlannerTrigger[];
  custom?: boolean;
}

export interface CandidateGroup {
  id: PackingCategory;
  name: string;
  items: CandidateItem[];
}

export interface PlanningResult {
  fingerprint: string;
  totalDays: number;
  laundryCycleDays: number;
  travelers: number;
  groups: CandidateGroup[];
}

export const CATEGORY_LABELS: Record<PackingCategory, string> = {
  documents: "证件与钱卡",
  electronics: "电子设备",
  clothes: "衣物",
  shoes: "鞋包配饰",
  care: "洗护与个人护理",
  health: "健康与常用药",
  transit: "途中与第一晚",
  household: "生活与落地购买",
};

export const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS) as PackingCategory[];
