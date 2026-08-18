import { describe, expect, it } from "vitest";

import { flattenMap, syncPackingMap } from "../src/engine/packingMap";
import { flattenCandidateItems, generatePackingSuggestions } from "../src/engine/planning";
import { refreshSafetyData } from "../src/engine/safety";
import { createPackMapDocument } from "../src/engine/trip";
import { PLANNER_SCENARIOS } from "./fixtures/plannerScenarios";

describe("beta trip scenario matrix", () => {
  it.each(Object.entries(PLANNER_SCENARIOS))("materializes %s without losing selected items", (_name, draft) => {
    const planning = generatePackingSuggestions(draft);
    const selected = flattenCandidateItems(planning).filter((item) => item.selected);
    const document = refreshSafetyData(syncPackingMap(createPackMapDocument(draft), draft, planning));
    const entries = flattenMap(document.containers);
    const mappedItemIds = new Set(entries.filter((entry) => entry.node.type === "item").map((entry) => entry.node.id));

    expect(selected.length).toBeGreaterThan(15);
    expect(document.containers.length).toBeGreaterThanOrEqual(2);
    expect(entries.some((entry) => entry.node.type === "bag")).toBe(true);
    expect(selected.every((item) => mappedItemIds.has(item.id))).toBe(true);
    expect(new Set(entries.map((entry) => entry.node.id)).size).toBe(entries.length);
    expect(document.departureChecks.length).toBeGreaterThan(8);
  });

  it("covers outdoor, cold-weather and multi-mode rules in the fifth scenario", () => {
    const result = generatePackingSuggestions(PLANNER_SCENARIOS.soloOutdoor);
    const ids = new Set(flattenCandidateItems(result).map((item) => item.id));
    expect(ids.has("hiking-shoes")).toBe(true);
    expect(ids.has("thermal-layers")).toBe(true);
    expect(ids.has("motion-sickness")).toBe(true);
  });
});
