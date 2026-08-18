import { describe, expect, it } from "vitest";

import {
  addMapNode,
  deleteMapNode,
  destinationEntries,
  findMapEntry,
  flattenMap,
  moveMapNode,
  organizeLooseItemsIntoPouches,
  packingStats,
  rebalanceLooseItems,
  searchPackingMap,
  syncPackingMap,
  togglePackedItem,
  unpackBag,
  updateMapNode,
} from "../src/engine/packingMap";
import { generatePackingSuggestions } from "../src/engine/planning";
import { createPackMapDocument } from "../src/engine/trip";
import type { PackMapDocument } from "../src/models/schema";
import { PLANNER_SCENARIOS } from "./fixtures/plannerScenarios";

function createMap(): PackMapDocument {
  const draft = {
    ...PLANNER_SCENARIOS.weeklyCity,
    bagSetup: "托运行李：开放面、拉链面\n随身背包：主仓、前袋",
  };
  return syncPackingMap(createPackMapDocument(draft), draft, generatePackingSuggestions(draft));
}

describe("packing map engine", () => {
  it("creates a valid hierarchy and places transport-sensitive items", () => {
    const document = createMap();
    const ids = flattenMap(document.containers).map((entry) => entry.node.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(document.containers).toHaveLength(2);
    expect(findMapEntry(document, "identity-documents")?.path).toEqual(["随身背包", "主仓", "证件包", "身份证件 / 护照"]);
    expect(findMapEntry(document, "hair-care")?.path).toEqual(["托运行李", "拉链面", "洗漱包", "洗发与护发用品"]);
    expect(findMapEntry(document, "transit-comfort-kit")?.path.slice(0, 2)).toEqual(["随身背包", "前袋"]);
  });

  it("moves items and prevents a pouch from moving into itself", () => {
    let document = createMap();
    const target = document.containers[0].children[1];
    document = moveMapNode(document, "identity-documents", target.id);
    expect(findMapEntry(document, "identity-documents")?.parentId).toBe(target.id);

    document = addMapNode(document, { type: "bag", name: "证件包", parentId: target.id });
    const pouch = flattenMap(document.containers).find((entry) => entry.node.type === "bag" && entry.node.name === "证件包");
    if (!pouch) throw new Error("pouch was not created");
    expect(destinationEntries(document, pouch.node.id).some((entry) => entry.node.id === pouch.node.id)).toBe(false);
    expect(moveMapNode(document, pouch.node.id, pouch.node.id)).toEqual(document);
  });

  it("supports add, edit, search, packed progress and delete", () => {
    let document = createMap();
    const targetId = document.containers[1].children[0].id;
    document = addMapNode(document, { type: "item", name: "备用眼镜", quantity: "1 副", parentId: targetId, notes: "落地备用" });
    const glasses = searchPackingMap(document, "备用眼镜")[0];
    if (!glasses) throw new Error("custom item was not created");
    expect(glasses.path.join(" / ")).toContain("随身背包 / 主仓 / 备用眼镜");

    document = updateMapNode(document, glasses.node.id, { name: "备用框架眼镜", quantity: "2 副" });
    expect(searchPackingMap(document, "框架")[0]?.node.type).toBe("item");
    document = togglePackedItem(document, glasses.node.id);
    expect(packingStats(document).packedItems).toBe(1);
    document = deleteMapNode(document, glasses.node.id);
    expect(findMapEntry(document, glasses.node.id)).toBeUndefined();
  });

  it("preserves custom locations while syncing changed recommendations", () => {
    const draft = { ...PLANNER_SCENARIOS.weeklyCity, bagSetup: "托运行李：主区\n随身背包：主仓" };
    const firstResult = generatePackingSuggestions(draft);
    let document = syncPackingMap(createPackMapDocument(draft), draft, firstResult);
    const targetId = document.containers[0].children[0].id;
    document = moveMapNode(document, "identity-documents", targetId);

    const secondResult = structuredClone(firstResult);
    const documents = secondResult.groups.find((group) => group.id === "documents");
    const booking = documents?.items.find((item) => item.id === "booking-documents");
    if (!booking) throw new Error("booking candidate is missing");
    booking.selected = false;
    document = syncPackingMap(document, draft, secondResult);

    expect(findMapEntry(document, "identity-documents")?.parentId).toBe(targetId);
    expect(findMapEntry(document, "booking-documents")).toBeUndefined();
  });

  it("balances prepacking across luggage with the same transport role", () => {
    const draft = {
      ...PLANNER_SCENARIOS.weeklyCity,
      bagSetup: "托运行李 A：主区、袋区\n托运行李 B：主区、袋区\n随身背包：主仓",
    };
    let document = syncPackingMap(createPackMapDocument(draft), draft, generatePackingSuggestions(draft));
    const checkedCounts = document.containers.slice(0, 2).map((luggage) =>
      flattenMap([luggage]).filter((entry) => entry.node.type === "item").length);
    expect(checkedCounts.every((count) => count > 0)).toBe(true);
    expect(Math.abs(checkedCounts[0] - checkedCounts[1])).toBeLessThanOrEqual(1);
    expect(findMapEntry(document, "identity-documents")?.path[0]).toBe("随身背包");

    const firstCheckedTarget = document.containers[0].children[0].id;
    const secondCheckedItem = flattenMap([document.containers[1]]).find((entry) => entry.node.type === "item");
    if (!secondCheckedItem) throw new Error("balanced fixture is missing a second-bag item");
    document = moveMapNode(document, secondCheckedItem.node.id, firstCheckedTarget);
    document = rebalanceLooseItems(document);
    expect(flattenMap([document.containers[1]]).some((entry) => entry.node.type === "item")).toBe(true);
  });

  it("merges newly organized loose items into an existing suggested pouch", () => {
    let document = createMap();
    const targetId = document.containers[0].children[1].id;
    document = addMapNode(document, { type: "item", name: "身体喷雾", quantity: "1 瓶", category: "care", parentId: targetId });
    document = organizeLooseItemsIntoPouches(document);
    const washBags = flattenMap(document.containers).filter((entry) => entry.node.type === "bag" && entry.node.name === "洗漱包");
    expect(washBags).toHaveLength(1);
    expect(searchPackingMap(document, "身体喷雾")[0]?.path).toContain("洗漱包");
  });

  it("removes a pouch without deleting the items inside it", () => {
    let document = createMap();
    const washBag = flattenMap(document.containers).find((entry) => entry.node.type === "bag" && entry.node.name === "洗漱包");
    if (!washBag?.parentId) throw new Error("wash bag fixture is missing");
    document = unpackBag(document, washBag.node.id);
    expect(findMapEntry(document, washBag.node.id)).toBeUndefined();
    expect(findMapEntry(document, "hair-care")?.parentId).toBe(washBag.parentId);
  });
});
