import { ITEM_CATALOG } from "../data/itemCatalog";
import type {
  BagNode,
  CompartmentNode,
  ContainerTransport,
  ItemNode,
  LuggageNode,
  PackingNode,
} from "../models/packing";
import { CATEGORY_LABELS, type CandidateItem, type PackingCategory, type PlanningResult } from "../models/planning";
import type { PackMapDocument } from "../models/schema";
import type { TripDraft } from "../models/trip";

export interface MapEntry {
  node: PackingNode;
  parentId: string | null;
  path: string[];
}

export interface MapStats {
  totalItems: number;
  packedItems: number;
  unpackedItems: number;
  percentage: number;
}

export type NewMapNode =
  | { type: "luggage"; name: string; transport: ContainerTransport }
  | { type: "compartment"; name: string; parentId: string }
  | { type: "bag"; name: string; parentId: string }
  | { type: "item"; name: string; parentId: string; quantity: string; category?: string; notes?: string };

export interface MapNodePatch {
  name?: string;
  quantity?: string;
  notes?: string;
  transport?: ContainerTransport;
}

interface BagStructure {
  name: string;
  compartments: string[];
}

function parseBagStructure(value: string): BagStructure[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, areas = "主区域"] = line.split(/[：:]/, 2);
      const compartments = areas.split(/[、,，]/).map((area) => area.trim()).filter(Boolean);
      return { name: name.trim() || "未命名箱包", compartments: compartments.length ? compartments : ["主区域"] };
    });
}

function inferTransport(name: string): ContainerTransport {
  if (/随身|背包|手提|登机|cabin/i.test(name)) return "carry-on";
  if (/托运|行李箱|旅行箱|拉杆箱|寸|suitcase/i.test(name)) return "checked";
  return "none";
}

function candidateToItem(candidate: CandidateItem): ItemNode {
  return {
    id: candidate.id,
    type: "item",
    name: candidate.name,
    quantity: candidate.quantity,
    category: candidate.category,
    packed: false,
    transportRule: candidate.transportRule,
    access: candidate.access,
    recommendation: candidate.recommendation,
    stageIds: [],
    reason: candidate.reason,
  };
}

function buildEmptyContainers(draft: TripDraft): LuggageNode[] {
  return parseBagStructure(draft.bagSetup).map((root, luggageIndex) => {
    const luggageId = `luggage-${luggageIndex + 1}`;
    return {
      id: luggageId,
      type: "luggage",
      name: root.name,
      transport: inferTransport(root.name),
      children: root.compartments.map((name, compartmentIndex) => ({
        id: `${luggageId}-compartment-${compartmentIndex + 1}`,
        type: "compartment",
        name,
        children: [],
      })),
    };
  });
}

function selectedCandidates(result: PlanningResult): CandidateItem[] {
  return result.groups.flatMap((group) => group.items).filter((item) => item.selected);
}

function allDestinations(containers: LuggageNode[]): Array<{ luggage: LuggageNode; compartment: CompartmentNode }> {
  return containers.flatMap((luggage) => luggage.children.map((compartment) => ({ luggage, compartment })));
}

type PlacementItem = Pick<ItemNode, "id" | "category" | "transportRule" | "access">;

function compartmentFor(luggage: LuggageNode, item: PlacementItem): CompartmentNode | null {
  if (!luggage.children.length) return null;
  const useSecondary = luggage.transport === "checked"
    ? item.category === "care" || item.category === "household"
    : item.category === "transit";
  return luggage.children[useSecondary ? Math.min(1, luggage.children.length - 1) : 0];
}

function nestedItemCount(nodes: Array<BagNode | ItemNode>): number {
  return nodes.reduce((count, node) => count + (node.type === "item" ? 1 : nestedItemCount(node.children)), 0);
}

function luggageItemCount(luggage: LuggageNode): number {
  return luggage.children.reduce((count, compartment) => count + nestedItemCount(compartment.children), 0);
}

function compatibleLuggage(containers: LuggageNode[], item: PlacementItem): LuggageNode[] {
  const carryOn = containers.filter((luggage) => luggage.transport === "carry-on");
  const checked = containers.filter((luggage) => luggage.transport === "checked");
  if (item.transportRule === "carry-on") return carryOn.length ? carryOn : checked.length ? checked : containers;
  if (item.transportRule === "checked") return checked.length ? checked : carryOn.length ? carryOn : containers;
  if (item.access === "airport" || item.access === "first-night") return carryOn.length ? carryOn : checked.length ? checked : containers;
  return checked.length ? checked : carryOn.length ? carryOn : containers;
}

function targetForItem(containers: LuggageNode[], item: PlacementItem): CompartmentNode | null {
  const destinations = allDestinations(containers);
  if (!destinations.length) return null;
  const compatible = compatibleLuggage(containers, item).filter((luggage) => luggage.children.length);
  const targetLuggage = compatible.reduce<LuggageNode | null>((best, luggage) =>
    !best || luggageItemCount(luggage) < luggageItemCount(best) ? luggage : best, null);
  return targetLuggage ? compartmentFor(targetLuggage, item) : destinations[0].compartment;
}

function placeCandidate(containers: LuggageNode[], candidate: CandidateItem): void {
  const target = targetForItem(containers, candidate);
  if (target) target.children.push(candidateToItem(candidate));
}

function suggestedPouchName(item: PlacementItem): string | null {
  if (item.category === "documents") return "证件包";
  if (item.category === "electronics") {
    return ["phone", "laptop", "headphones"].includes(item.id) ? null : "电子配件包";
  }
  if (item.category === "clothes") {
    return ["underwear", "socks"].includes(item.id) ? "内衣收纳袋" : "衣物收纳袋";
  }
  if (item.category === "shoes") return null;
  if (item.category === "care") return "洗漱包";
  if (item.category === "health") return item.transportRule === "carry-on" || item.access === "airport" || item.access === "first-night"
    ? "随身药包"
    : "备用药包";
  if (item.category === "transit") {
    if (item.id === "empty-water-bottle") return null;
    return item.transportRule === "checked" ? "第一晚用品袋" : "途中用品包";
  }
  if (item.category === "household") {
    if (["foldable-tote", "shopping-buffer"].includes(item.id)) return null;
    if (item.id === "children-transit-kit") return "儿童途中用品包";
    return "生活用品袋";
  }
  return null;
}

function nextSuggestedBagId(containers: LuggageNode[], index: number): string {
  const existing = new Set(flattenMap(containers).map((entry) => entry.node.id));
  let suffix = index + 1;
  let id = `suggested-bag-${suffix}`;
  while (existing.has(id)) id = `suggested-bag-${++suffix}`;
  return id;
}

function cloneBag(node: BagNode): BagNode {
  return {
    ...node,
    children: node.children.map((child) => child.type === "bag" ? cloneBag(child) : { ...child }),
  };
}

export function organizeLooseItemsIntoPouches(document: PackMapDocument): PackMapDocument {
  const looseItems = document.containers.flatMap((luggage) => luggage.children.flatMap((compartment) =>
    compartment.children.filter((node): node is ItemNode => node.type === "item")));
  if (!looseItems.length) return document;
  const containers = document.containers.map((luggage) => ({
    ...luggage,
    children: luggage.children.map((compartment) => ({
      ...compartment,
      children: compartment.children.flatMap((node) => node.type === "bag" ? [cloneBag(node)] : []),
    })),
  }));
  const pouchGroups = new Map<string, ItemNode[]>();
  const remainLoose: ItemNode[] = [];
  looseItems.forEach((item) => {
    const pouchName = suggestedPouchName(item);
    if (!pouchName) {
      remainLoose.push(item);
      return;
    }
    pouchGroups.set(pouchName, [...(pouchGroups.get(pouchName) ?? []), item]);
  });
  [...pouchGroups.entries()].forEach(([name, items], index) => {
    const existing = flattenMap(containers).find((entry) => entry.node.type === "bag" && entry.node.name === name);
    if (existing?.node.type === "bag") {
      existing.node.children.push(...items);
      return;
    }
    const target = targetForItem(containers, items[0]);
    if (target) target.children.push({ id: nextSuggestedBagId(containers, index), type: "bag", name, children: items });
  });
  remainLoose.forEach((item) => {
    const target = targetForItem(containers, item);
    if (target) target.children.push(item);
  });
  return touch({ ...document, containers });
}

function updateCandidateNodes(nodes: Array<BagNode | ItemNode>, candidates: Map<string, CandidateItem>): Array<BagNode | ItemNode> {
  const catalogIds = new Set(ITEM_CATALOG.map((item) => item.id));
  return nodes.flatMap<BagNode | ItemNode>((node): Array<BagNode | ItemNode> => {
    if (node.type === "bag") return [{ ...node, children: updateCandidateNodes(node.children, candidates) }];
    const candidate = candidates.get(node.id);
    if (!candidate && (catalogIds.has(node.id) || node.id.startsWith("custom-candidate-"))) return [];
    if (!candidate) return [node];
    return [{
      ...node,
      name: candidate.name,
      quantity: candidate.quantity,
      category: candidate.category,
      transportRule: candidate.transportRule,
      access: candidate.access,
      recommendation: candidate.recommendation,
      reason: candidate.reason,
    }];
  });
}

function touch(document: PackMapDocument): PackMapDocument {
  return { ...document, updatedAt: new Date().toISOString() };
}

export function syncPackingMap(document: PackMapDocument, draft: TripDraft, result: PlanningResult): PackMapDocument {
  const selected = selectedCandidates(result);
  const candidateById = new Map(selected.map((candidate) => [candidate.id, candidate]));
  const isNewMap = document.containers.length === 0;
  const containers = document.containers.length
    ? document.containers.map((luggage) => ({
        ...luggage,
        children: luggage.children.map((compartment) => ({
          ...compartment,
          children: updateCandidateNodes(compartment.children, candidateById),
        })),
      }))
    : buildEmptyContainers(draft);

  const existingIds = new Set(flattenMap(containers).filter((entry) => entry.node.type === "item").map((entry) => entry.node.id));
  selected.filter((candidate) => !existingIds.has(candidate.id)).forEach((candidate) => placeCandidate(containers, candidate));
  const nextDocument = touch({ ...document, containers });
  return isNewMap ? organizeLooseItemsIntoPouches(nextDocument) : nextDocument;
}

export function rebalanceLooseItems(document: PackMapDocument): PackMapDocument {
  if (document.containers.length < 2) return document;
  const looseItems = document.containers.flatMap((luggage) => luggage.children.flatMap((compartment) =>
    compartment.children.filter((node): node is ItemNode => node.type === "item")));
  if (!looseItems.length) return document;
  const containers = document.containers.map((luggage) => ({
    ...luggage,
    children: luggage.children.map((compartment) => ({
      ...compartment,
      children: compartment.children.filter((node) => node.type === "bag"),
    })),
  }));
  looseItems.forEach((item) => {
    const target = targetForItem(containers, item);
    if (target) target.children.push(item);
  });
  return touch({ ...document, containers });
}

function walkBag(node: BagNode, parentId: string, path: string[], entries: MapEntry[]): void {
  const nextPath = [...path, node.name];
  entries.push({ node, parentId, path: nextPath });
  node.children.forEach((child) => {
    if (child.type === "bag") walkBag(child, node.id, nextPath, entries);
    else entries.push({ node: child, parentId: node.id, path: [...nextPath, child.name] });
  });
}

export function flattenMap(containers: LuggageNode[]): MapEntry[] {
  const entries: MapEntry[] = [];
  containers.forEach((luggage) => {
    const luggagePath = [luggage.name];
    entries.push({ node: luggage, parentId: null, path: luggagePath });
    luggage.children.forEach((compartment) => {
      const compartmentPath = [...luggagePath, compartment.name];
      entries.push({ node: compartment, parentId: luggage.id, path: compartmentPath });
      compartment.children.forEach((child) => {
        if (child.type === "bag") walkBag(child, compartment.id, compartmentPath, entries);
        else entries.push({ node: child, parentId: compartment.id, path: [...compartmentPath, child.name] });
      });
    });
  });
  return entries;
}

export function findMapEntry(document: PackMapDocument, nodeId: string): MapEntry | undefined {
  return flattenMap(document.containers).find((entry) => entry.node.id === nodeId);
}

export function searchPackingMap(document: PackMapDocument, query: string): MapEntry[] {
  const normalized = query.trim().toLocaleLowerCase("zh-CN");
  if (!normalized) return [];
  return flattenMap(document.containers).filter((entry) => {
    const itemDetails = entry.node.type === "item"
      ? `${entry.node.quantity} ${entry.node.notes ?? ""} ${entry.node.category} ${CATEGORY_LABELS[entry.node.category as PackingCategory] ?? ""}`
      : "";
    return `${entry.path.join(" ")} ${itemDetails}`.toLocaleLowerCase("zh-CN").includes(normalized);
  });
}

export function packingStats(document: PackMapDocument): MapStats {
  const items = flattenMap(document.containers).map((entry) => entry.node).filter((node): node is ItemNode => node.type === "item");
  const packedItems = items.filter((item) => item.packed).length;
  return {
    totalItems: items.length,
    packedItems,
    unpackedItems: items.length - packedItems,
    percentage: items.length ? Math.round((packedItems / items.length) * 100) : 0,
  };
}

export function destinationEntries(document: PackMapDocument, movingNodeId?: string): MapEntry[] {
  const moving = movingNodeId ? findMapEntry(document, movingNodeId) : undefined;
  const blockedIds = new Set<string>();
  if (moving?.node.type === "bag") {
    blockedIds.add(moving.node.id);
    flattenBagIds(moving.node, blockedIds);
  }
  return flattenMap(document.containers).filter((entry) =>
    (entry.node.type === "compartment" || entry.node.type === "bag") && !blockedIds.has(entry.node.id));
}

function flattenBagIds(bag: BagNode, ids: Set<string>): void {
  bag.children.forEach((child) => {
    if (child.type === "bag") {
      ids.add(child.id);
      flattenBagIds(child, ids);
    }
  });
}

function detachFromBagChildren(children: Array<BagNode | ItemNode>, nodeId: string): { children: Array<BagNode | ItemNode>; detached?: BagNode | ItemNode } {
  let detached: BagNode | ItemNode | undefined;
  const next = children.flatMap<BagNode | ItemNode>((child): Array<BagNode | ItemNode> => {
    if (child.id === nodeId) {
      detached = child;
      return [];
    }
    if (child.type === "bag") {
      const nested = detachFromBagChildren(child.children, nodeId);
      if (nested.detached) detached = nested.detached;
      return [{ ...child, children: nested.children }];
    }
    return [child];
  });
  return { children: next, detached };
}

function appendToBagChildren(children: Array<BagNode | ItemNode>, targetId: string, node: BagNode | ItemNode): { children: Array<BagNode | ItemNode>; appended: boolean } {
  let appended = false;
  const next = children.map((child) => {
    if (child.type !== "bag") return child;
    if (child.id === targetId) {
      appended = true;
      return { ...child, children: [...child.children, node] };
    }
    const nested = appendToBagChildren(child.children, targetId, node);
    if (nested.appended) appended = true;
    return { ...child, children: nested.children };
  });
  return { children: next, appended };
}

export function moveMapNode(document: PackMapDocument, nodeId: string, targetId: string): PackMapDocument {
  const moving = findMapEntry(document, nodeId);
  if (!moving || (moving.node.type !== "item" && moving.node.type !== "bag")) return document;
  if (!destinationEntries(document, nodeId).some((entry) => entry.node.id === targetId)) return document;

  let detached: BagNode | ItemNode | undefined;
  let containers = document.containers.map((luggage) => ({
    ...luggage,
    children: luggage.children.map((compartment) => {
      if (compartment.children.some((child) => child.id === nodeId)) {
        const child = compartment.children.find((entry) => entry.id === nodeId);
        detached = child;
        return { ...compartment, children: compartment.children.filter((child) => child.id !== nodeId) };
      }
      const result = detachFromBagChildren(compartment.children, nodeId);
      if (result.detached) detached = result.detached;
      return { ...compartment, children: result.children };
    }),
  }));
  if (!detached) return document;

  let appended = false;
  containers = containers.map((luggage) => ({
    ...luggage,
    children: luggage.children.map((compartment) => {
      if (compartment.id === targetId) {
        appended = true;
        return { ...compartment, children: [...compartment.children, detached!] };
      }
      const result = appendToBagChildren(compartment.children, targetId, detached!);
      if (result.appended) appended = true;
      return { ...compartment, children: result.children };
    }),
  }));
  return appended ? touch({ ...document, containers }) : document;
}

function updateBagChildren(children: Array<BagNode | ItemNode>, nodeId: string, patch: MapNodePatch): Array<BagNode | ItemNode> {
  return children.map((child) => {
    if (child.id === nodeId) {
      if (child.type === "item") return { ...child, ...patch, name: patch.name ?? child.name, quantity: patch.quantity ?? child.quantity, notes: patch.notes ?? child.notes };
      return { ...child, name: patch.name ?? child.name };
    }
    return child.type === "bag" ? { ...child, children: updateBagChildren(child.children, nodeId, patch) } : child;
  });
}

export function updateMapNode(document: PackMapDocument, nodeId: string, patch: MapNodePatch): PackMapDocument {
  if (!findMapEntry(document, nodeId)) return document;
  if (!patch.name?.trim() && patch.name !== undefined) return document;
  const containers = document.containers.map((luggage) => {
    if (luggage.id === nodeId) return { ...luggage, name: patch.name ?? luggage.name, transport: patch.transport ?? luggage.transport };
    return {
      ...luggage,
      children: luggage.children.map((compartment) => compartment.id === nodeId
        ? { ...compartment, name: patch.name ?? compartment.name }
        : { ...compartment, children: updateBagChildren(compartment.children, nodeId, patch) }),
    };
  });
  return touch({ ...document, containers });
}

function removeFromBagChildren(children: Array<BagNode | ItemNode>, nodeId: string): Array<BagNode | ItemNode> {
  return children.filter((child) => child.id !== nodeId).map((child) =>
    child.type === "bag" ? { ...child, children: removeFromBagChildren(child.children, nodeId) } : child);
}

function unpackFromBagChildren(
  children: Array<BagNode | ItemNode>,
  bagId: string,
): { children: Array<BagNode | ItemNode>; unpacked: boolean } {
  let unpacked = false;
  const next = children.flatMap<BagNode | ItemNode>((child): Array<BagNode | ItemNode> => {
    if (child.type !== "bag") return [child];
    if (child.id === bagId) {
      unpacked = true;
      return child.children;
    }
    const nested = unpackFromBagChildren(child.children, bagId);
    if (nested.unpacked) unpacked = true;
    return [{ ...child, children: nested.children }];
  });
  return { children: next, unpacked };
}

export function unpackBag(document: PackMapDocument, bagId: string): PackMapDocument {
  const entry = findMapEntry(document, bagId);
  if (entry?.node.type !== "bag") return document;
  let unpacked = false;
  const containers = document.containers.map((luggage) => ({
    ...luggage,
    children: luggage.children.map((compartment) => {
      const result = unpackFromBagChildren(compartment.children, bagId);
      if (result.unpacked) unpacked = true;
      return { ...compartment, children: result.children };
    }),
  }));
  return unpacked ? touch({ ...document, containers }) : document;
}

export function deleteMapNode(document: PackMapDocument, nodeId: string): PackMapDocument {
  if (!findMapEntry(document, nodeId)) return document;
  const containers = document.containers
    .filter((luggage) => luggage.id !== nodeId)
    .map((luggage) => ({
      ...luggage,
      children: luggage.children
        .filter((compartment) => compartment.id !== nodeId)
        .map((compartment) => ({ ...compartment, children: removeFromBagChildren(compartment.children, nodeId) })),
    }));
  return touch({ ...document, containers });
}

function nextNodeId(document: PackMapDocument, type: NewMapNode["type"]): string {
  const existing = new Set(flattenMap(document.containers).map((entry) => entry.node.id));
  let index = existing.size + 1;
  let id = `custom-${type}-${index}`;
  while (existing.has(id)) id = `custom-${type}-${++index}`;
  return id;
}

export function addMapNode(document: PackMapDocument, input: NewMapNode): PackMapDocument {
  const name = input.name.trim();
  if (!name) return document;
  const id = nextNodeId(document, input.type);
  if (input.type === "luggage") {
    return touch({ ...document, containers: [...document.containers, { id, type: "luggage", name, transport: input.transport, children: [] }] });
  }
  if (input.type === "compartment") {
    if (!document.containers.some((luggage) => luggage.id === input.parentId)) return document;
    return touch({
      ...document,
      containers: document.containers.map((luggage) => luggage.id === input.parentId
        ? { ...luggage, children: [...luggage.children, { id, type: "compartment", name, children: [] }] }
        : luggage),
    });
  }

  if (!destinationEntries(document).some((entry) => entry.node.id === input.parentId)) return document;
  const node: BagNode | ItemNode = input.type === "bag"
    ? { id, type: "bag", name, children: [] }
    : {
        id,
        type: "item",
        name,
        quantity: input.quantity.trim() || "1 件",
        category: input.category ?? "custom",
        packed: false,
        transportRule: "none",
        access: "any",
        recommendation: "bring",
        stageIds: [],
        notes: input.notes?.trim(),
      };
  let appended = false;
  const containers = document.containers.map((luggage) => ({
    ...luggage,
    children: luggage.children.map((compartment) => {
      if (compartment.id === input.parentId) {
        appended = true;
        return { ...compartment, children: [...compartment.children, node] };
      }
      const result = appendToBagChildren(compartment.children, input.parentId, node);
      if (result.appended) appended = true;
      return { ...compartment, children: result.children };
    }),
  }));
  return appended ? touch({ ...document, containers }) : document;
}

function togglePackedInChildren(children: Array<BagNode | ItemNode>, itemId: string): Array<BagNode | ItemNode> {
  return children.map((child) => {
    if (child.type === "item") return child.id === itemId ? { ...child, packed: !child.packed } : child;
    return { ...child, children: togglePackedInChildren(child.children, itemId) };
  });
}

export function togglePackedItem(document: PackMapDocument, itemId: string): PackMapDocument {
  const entry = findMapEntry(document, itemId);
  if (!entry || entry.node.type !== "item") return document;
  return touch({
    ...document,
    containers: document.containers.map((luggage) => ({
      ...luggage,
      children: luggage.children.map((compartment) => ({
        ...compartment,
        children: togglePackedInChildren(compartment.children, itemId),
      })),
    })),
  });
}

function setPackedInChildren(children: Array<BagNode | ItemNode>, packed: boolean): Array<BagNode | ItemNode> {
  return children.map((child) => child.type === "item"
    ? { ...child, packed }
    : { ...child, children: setPackedInChildren(child.children, packed) });
}

export function setAllItemsPacked(document: PackMapDocument, packed: boolean): PackMapDocument {
  if (packingStats(document).totalItems === 0) return document;
  return touch({
    ...document,
    containers: document.containers.map((luggage) => ({
      ...luggage,
      children: luggage.children.map((compartment) => ({
        ...compartment,
        children: setPackedInChildren(compartment.children, packed),
      })),
    })),
  });
}
