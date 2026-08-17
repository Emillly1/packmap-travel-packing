import { describe, expect, it } from "vitest";

import { getTripTemplate } from "../src/data/templates";
import type { AppState } from "../src/state/store";
import { reduceAppState } from "../src/state/store";

function readyState(): AppState {
  const template = getTripTemplate("city");
  return {
    screen: "wizard",
    selectedTemplate: "city",
    wizardStep: 3,
    draft: {
      ...template.defaults,
      transportModes: [...template.defaults.transportModes],
      origin: "上海",
      destinationsText: "罗马、佛罗伦萨",
      startDate: "2026-09-10",
      endDate: "2026-09-20",
    },
    activeDocument: null,
    planningResult: null,
    planningConfirmed: false,
    workspaceSearch: "",
    selectedMapNodeId: null,
    workspaceMode: "inspect",
    collapsedNodeIds: [],
    documentHistory: [],
    notice: null,
    error: null,
  };
}

describe("packing review flow", () => {
  it("opens review before entering the workspace", () => {
    const state = reduceAppState(readyState(), { type: "COMPLETE_SETUP" });
    expect(state.screen).toBe("review");
    expect(state.activeDocument?.trip.destinations).toEqual(["罗马", "佛罗伦萨"]);
    expect(state.planningResult?.groups.length).toBeGreaterThan(0);
    expect(state.planningConfirmed).toBe(false);
  });

  it("persists item and group choices before confirmation", () => {
    const review = reduceAppState(readyState(), { type: "COMPLETE_SETUP" });
    const firstGroup = review.planningResult?.groups[0];
    const firstItem = firstGroup?.items[0];
    if (!firstGroup || !firstItem) throw new Error("candidate fixture is missing");

    const toggled = reduceAppState(review, { type: "TOGGLE_CANDIDATE", itemId: firstItem.id });
    expect(toggled.planningResult?.groups[0].items[0].selected).toBe(!firstItem.selected);

    const cleared = reduceAppState(toggled, { type: "SET_GROUP_SELECTION", category: firstGroup.id, selected: false });
    expect(cleared.planningResult?.groups[0].items.every((item) => !item.selected)).toBe(true);

    const confirmed = reduceAppState(cleared, { type: "CONFIRM_CANDIDATES" });
    expect(confirmed.screen).toBe("workspace");
    expect(confirmed.planningConfirmed).toBe(true);
    expect(confirmed.activeDocument?.containers.length).toBeGreaterThan(0);
  });

  it("returns to the confirmed workspace when trip editing is cancelled", () => {
    const review = reduceAppState(readyState(), { type: "COMPLETE_SETUP" });
    const workspace = reduceAppState(review, { type: "CONFIRM_CANDIDATES" });
    const editing = reduceAppState(workspace, { type: "EDIT_TRIP" });
    expect(reduceAppState(editing, { type: "CANCEL_EDIT" }).screen).toBe("workspace");
  });

  it("tracks map changes and restores the previous document on undo", () => {
    const review = reduceAppState(readyState(), { type: "COMPLETE_SETUP" });
    const workspace = reduceAppState(review, { type: "CONFIRM_CANDIDATES" });
    const changed = reduceAppState(workspace, { type: "TOGGLE_PACKED_ITEM", itemId: "identity-documents" });
    expect(changed.documentHistory).toHaveLength(1);
    expect(changed.notice).toBe("已更新装入状态。");

    const restored = reduceAppState(changed, { type: "UNDO_MAP_CHANGE" });
    expect(restored.documentHistory).toHaveLength(0);
    expect(restored.activeDocument).toEqual(workspace.activeDocument);
  });
});
