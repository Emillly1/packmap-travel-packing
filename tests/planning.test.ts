import { describe, expect, it } from "vitest";

import { ITEM_CATALOG } from "../src/data/itemCatalog";
import { flattenCandidateItems, generatePackingSuggestions, reconcilePlanningSelections } from "../src/engine/planning";
import { PLANNER_SCENARIOS } from "./fixtures/plannerScenarios";

function byId(result: ReturnType<typeof generatePackingSuggestions>, id: string) {
  return flattenCandidateItems(result).find((item) => item.id === id);
}

describe("planning engine", () => {
  it("keeps catalog IDs unique", () => {
    const ids = ITEM_CATALOG.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("calculates weekly laundry quantities", () => {
    const result = generatePackingSuggestions(PLANNER_SCENARIOS.weeklyCity);
    expect(result.totalDays).toBe(11);
    expect(result.laundryCycleDays).toBe(7);
    expect(byId(result, "everyday-tops")?.quantity).toBe("7 件");
    expect(byId(result, "underwear")?.quantity).toBe("9 套");
    expect(byId(result, "bottoms")?.quantity).toBe("3 件");
  });

  it("lets explicit no-hiking language override suggestions", () => {
    const result = generatePackingSuggestions(PLANNER_SCENARIOS.weeklyCity);
    expect(byId(result, "hiking-shoes")).toBeUndefined();
    expect(byId(result, "activewear")).toBeUndefined();
  });

  it("adds outdoor, cold, long-trip, study and first-night modules", () => {
    const result = generatePackingSuggestions(PLANNER_SCENARIOS.longStudy);
    expect(byId(result, "hiking-shoes")?.selected).toBe(true);
    expect(byId(result, "thermal-layers")?.selected).toBe(true);
    expect(byId(result, "student-documents")?.transportRule).toBe("carry-on");
    expect(byId(result, "bulk-laundry")?.recommendation).toBe("buy-local");
    expect(byId(result, "first-night-clothes")?.access).toBe("first-night");
    expect(byId(result, "shopping-buffer")?.quantity).toBe("至少 20%");
  });

  it("scales personal items but keeps shared items singular", () => {
    const result = generatePackingSuggestions(PLANNER_SCENARIOS.familyBeach);
    expect(byId(result, "identity-documents")?.quantity).toBe("1 套 × 3 人");
    expect(byId(result, "everyday-tops")?.quantity).toBe("7 件 × 3 人");
    expect(byId(result, "umbrella")?.quantity).toBe("1 把");
    expect(byId(result, "swimwear")?.quantity).toBe("1 套 × 3 人");
    expect(byId(result, "children-transit-kit")?.transportRule).toBe("carry-on");
  });

  it("keeps optional transport extras unselected", () => {
    const result = generatePackingSuggestions(PLANNER_SCENARIOS.weeklyCity);
    expect(byId(result, "motion-sickness")?.selected).toBe(false);
    expect(byId(result, "empty-water-bottle")?.selected).toBe(false);
  });

  it("produces deterministic output and preserves user selections on regeneration", () => {
    const first = generatePackingSuggestions(PLANNER_SCENARIOS.winterBusiness);
    const second = generatePackingSuggestions(PLANNER_SCENARIOS.winterBusiness);
    expect(second).toEqual(first);

    const formal = byId(first, "formal-outfit");
    if (!formal) throw new Error("formal outfit fixture is missing");
    formal.selected = false;
    const reconciled = reconcilePlanningSelections(second, first);
    expect(byId(reconciled, "formal-outfit")?.selected).toBe(false);
  });
});
