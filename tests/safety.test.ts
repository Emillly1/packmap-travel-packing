import { describe, expect, it } from "vitest";

import { addMapNode, moveMapNode, updateMapNode } from "../src/engine/packingMap";
import { generatePackingSuggestions } from "../src/engine/planning";
import { acknowledgeWarning, refreshSafetyData, toggleDepartureCheck } from "../src/engine/safety";
import { createPackMapDocument } from "../src/engine/trip";
import type { PackMapDocument } from "../src/models/schema";
import { syncPackingMap } from "../src/engine/packingMap";
import { PLANNER_SCENARIOS } from "./fixtures/plannerScenarios";

function createAuditedMap(): PackMapDocument {
  const draft = {
    ...PLANNER_SCENARIOS.weeklyCity,
    bagSetup: "托运行李：主区\n随身背包：主仓",
  };
  return refreshSafetyData(syncPackingMap(createPackMapDocument(draft), draft, generatePackingSuggestions(draft)));
}

describe("safety and departure engine", () => {
  it("detects batteries and valuables without duplicate generic warnings", () => {
    let document = createAuditedMap();
    const checkedTarget = document.containers[0].children[0].id;
    document = refreshSafetyData(moveMapNode(document, "power-bank", checkedTarget));
    document = refreshSafetyData(moveMapNode(document, "identity-documents", checkedTarget));

    expect(document.warnings.some((warning) => warning.id === "warning-battery-checked-power-bank" && warning.severity === "high")).toBe(true);
    expect(document.warnings.some((warning) => warning.id === "warning-valuable-checked-identity-documents")).toBe(true);
    expect(document.warnings.some((warning) => warning.id === "warning-carry-rule-mismatch-identity-documents")).toBe(false);
  });

  it("detects blades and large liquids in carry-on luggage", () => {
    let document = createAuditedMap();
    const carryTarget = document.containers[1].children[0].id;
    document = addMapNode(document, { type: "item", name: "瑞士军刀", quantity: "1 把", parentId: carryTarget });
    document = addMapNode(document, { type: "item", name: "身体乳 250ml", quantity: "1 瓶", parentId: carryTarget });
    document = refreshSafetyData(document);

    expect(document.warnings.some((warning) => warning.id.includes("blade-carry-on"))).toBe(true);
    expect(document.warnings.some((warning) => warning.id.includes("large-liquid-carry-on"))).toBe(true);
  });

  it("preserves acknowledged warnings while their issue remains", () => {
    let document = createAuditedMap();
    const checkedTarget = document.containers[0].children[0].id;
    document = refreshSafetyData(moveMapNode(document, "power-bank", checkedTarget));
    document = acknowledgeWarning(document, "warning-battery-checked-power-bank");
    document = refreshSafetyData(updateMapNode(document, "power-bank", { notes: "已确认航空公司要求" }));
    expect(document.warnings.find((warning) => warning.id === "warning-battery-checked-power-bank")?.acknowledged).toBe(true);
  });

  it("builds transport-aware departure checks and preserves completion", () => {
    let document = createAuditedMap();
    expect(document.departureChecks.some((check) => check.id === "transport-boarding")).toBe(true);
    expect(document.departureChecks.some((check) => check.id === "transport-train")).toBe(true);
    expect(document.departureChecks.some((check) => check.id === "transport-driving")).toBe(false);

    document = toggleDepartureCheck(document, "documents-passport");
    document = refreshSafetyData(document);
    expect(document.departureChecks.find((check) => check.id === "documents-passport")?.checked).toBe(true);
  });
});
