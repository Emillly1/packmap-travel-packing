import {
  destinationEntries,
  findMapEntry,
  flattenMap,
  packingStats,
  searchPackingMap,
  type MapEntry,
  type NewMapNode,
} from "../engine/packingMap";
import { CATEGORY_LABELS } from "../models/planning";
import type { BagNode, ContainerTransport, ItemNode, PackingNode } from "../models/packing";
import type { AppState, AppStore, WorkspaceMode } from "../state/store";

const CATEGORY_MARKS: Record<string, string> = {
  documents: "证",
  electronics: "电",
  clothes: "衣",
  shoes: "鞋",
  care: "护",
  health: "药",
  transit: "途",
  household: "生",
  custom: "自",
};

const NODE_LABELS: Record<PackingNode["type"], string> = {
  luggage: "箱包",
  compartment: "分区",
  bag: "收纳袋",
  item: "物品",
};

const TRANSPORT_LABELS: Record<ContainerTransport, string> = {
  "carry-on": "随身",
  checked: "托运",
  none: "未指定",
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function itemStats(nodes: Array<BagNode | ItemNode>): { total: number; packed: number } {
  return nodes.reduce((total, node) => {
    if (node.type === "item") return { total: total.total + 1, packed: total.packed + Number(node.packed) };
    const nested = itemStats(node.children);
    return { total: total.total + nested.total, packed: total.packed + nested.packed };
  }, { total: 0, packed: 0 });
}

function renderItem(item: ItemNode, selectedId: string | null, matchedIds: Set<string>): string {
  const selected = selectedId === item.id;
  const matched = matchedIds.has(item.id);
  return `
    <article class="map-item ${item.packed ? "is-packed" : ""} ${selected ? "is-selected" : ""} ${matched ? "is-match" : ""}"
      draggable="true" data-drag-node="${item.id}" data-map-node-id="${item.id}">
      <button class="pack-check" type="button" data-pack-id="${item.id}" aria-label="${item.packed ? "标记未装" : "标记已装"}">
        <span aria-hidden="true">${item.packed ? "✓" : ""}</span>
      </button>
      <button class="map-item__body" type="button" data-select-node="${item.id}">
        <i aria-hidden="true">${CATEGORY_MARKS[item.category] ?? "物"}</i>
        <span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.quantity)}</small></span>
      </button>
      ${item.transportRule !== "none" ? `<b class="transport-pin transport-pin--${item.transportRule}">${TRANSPORT_LABELS[item.transportRule]}</b>` : ""}
    </article>
  `;
}

function renderBag(bag: BagNode, state: AppState, matchedIds: Set<string>, depth = 0): string {
  const collapsed = state.collapsedNodeIds.includes(bag.id);
  const stats = itemStats(bag.children);
  return `
    <section class="pouch pouch--depth-${Math.min(depth, 2)} ${state.selectedMapNodeId === bag.id ? "is-selected" : ""}"
      draggable="true" data-drag-node="${bag.id}" data-drop-target="${bag.id}" data-map-node-id="${bag.id}">
      <header>
        <button class="collapse-button" type="button" data-collapse-id="${bag.id}" aria-label="${collapsed ? "展开" : "折叠"} ${escapeHtml(bag.name)}">
          <span aria-hidden="true">${collapsed ? "+" : "−"}</span>
        </button>
        <button class="pouch-title" type="button" data-select-node="${bag.id}">
          <strong>${escapeHtml(bag.name)}</strong><small>${stats.packed}/${stats.total} 已装</small>
        </button>
        <span class="pouch-grip" aria-hidden="true">:::</span>
      </header>
      ${collapsed ? "" : `<div class="pouch-contents">
        ${bag.children.map((child) => child.type === "item"
          ? renderItem(child, state.selectedMapNodeId, matchedIds)
          : renderBag(child, state, matchedIds, depth + 1)).join("")}
        ${bag.children.length ? "" : '<span class="drop-placeholder">空</span>'}
      </div>`}
    </section>
  `;
}

function renderLuggage(state: AppState, matchedIds: Set<string>): string {
  const document = state.activeDocument;
  if (!document) return "";
  return document.containers.map((luggage, luggageIndex) => {
    const stats = luggage.children.reduce((total, compartment) => {
      const next = itemStats(compartment.children);
      return { total: total.total + next.total, packed: total.packed + next.packed };
    }, { total: 0, packed: 0 });
    return `
      <section class="packing-case packing-case--${luggageIndex % 4} ${state.selectedMapNodeId === luggage.id ? "is-selected" : ""}" data-map-node-id="${luggage.id}">
        <div class="packing-case__handle" aria-hidden="true"></div>
        <header class="packing-case__header">
          <button type="button" data-select-node="${luggage.id}">
            <span>0${luggageIndex + 1}</span>
            <strong>${escapeHtml(luggage.name)}</strong>
          </button>
          <div><b>${TRANSPORT_LABELS[luggage.transport]}</b><small>${stats.packed}/${stats.total} 已装</small></div>
        </header>
        <div class="packing-case__body">
          ${luggage.children.map((compartment) => {
            const compartmentStats = itemStats(compartment.children);
            return `
              <section class="compartment ${state.selectedMapNodeId === compartment.id ? "is-selected" : ""}"
                data-drop-target="${compartment.id}" data-map-node-id="${compartment.id}">
                <header>
                  <button type="button" data-select-node="${compartment.id}"><strong>${escapeHtml(compartment.name)}</strong></button>
                  <span>${compartmentStats.packed}/${compartmentStats.total}</span>
                </header>
                <div class="compartment-contents">
                  ${compartment.children.map((child) => child.type === "item"
                    ? renderItem(child, state.selectedMapNodeId, matchedIds)
                    : renderBag(child, state, matchedIds)).join("")}
                  ${compartment.children.length ? "" : '<span class="drop-placeholder">空分区</span>'}
                </div>
              </section>
            `;
          }).join("")}
          ${luggage.children.length ? "" : '<div class="empty-case">尚未建立分区</div>'}
        </div>
      </section>
    `;
  }).join("");
}

function renderInventory(state: AppState): string {
  const document = state.activeDocument;
  if (!document) return "";
  const entries = flattenMap(document.containers);
  const items = entries.filter((entry): entry is MapEntry & { node: ItemNode } => entry.node.type === "item");
  const results = searchPackingMap(document, state.workspaceSearch);
  const categories = Object.entries(CATEGORY_LABELS).map(([id, name]) => {
    const categoryItems = items.filter((entry) => entry.node.category === id);
    if (!categoryItems.length) return "";
    return `
      <button class="inventory-category" type="button" data-search-category="${escapeHtml(name)}">
        <i aria-hidden="true">${CATEGORY_MARKS[id]}</i><span>${escapeHtml(name)}</span><b>${categoryItems.length}</b>
      </button>
    `;
  }).join("");
  return `
    <aside class="inventory-panel">
      <div class="workspace-search">
        <label for="workspaceSearch">搜索物品或位置</label>
        <div><input id="workspaceSearch" value="${escapeHtml(state.workspaceSearch)}" autocomplete="off" placeholder="例如：护照、主仓"><button type="button" data-clear-search aria-label="清除搜索">×</button></div>
      </div>
      <div class="inventory-tabs"><strong>${state.workspaceSearch ? "搜索结果" : "物品分类"}</strong><span>${state.workspaceSearch ? results.length : items.length}</span></div>
      <div class="inventory-list">
        ${state.workspaceSearch
          ? results.map((entry) => `
              <button class="search-result" type="button" data-search-result="${entry.node.id}">
                <i>${NODE_LABELS[entry.node.type]}</i>
                <span><strong>${escapeHtml(entry.node.name)}</strong><small>${entry.path.slice(0, -1).map(escapeHtml).join(" / ") || "一级目录"}</small></span>
              </button>
            `).join("") || '<p class="inventory-empty">没有匹配内容</p>'
          : categories}
      </div>
      <div class="inventory-actions">
        <strong>新增</strong>
        <div>
          <button type="button" data-workspace-mode="add-item">物品</button>
          <button type="button" data-workspace-mode="add-bag">收纳袋</button>
          <button type="button" data-workspace-mode="add-compartment">分区</button>
          <button type="button" data-workspace-mode="add-luggage">箱包</button>
        </div>
      </div>
      <button class="undo-button" type="button" data-action="undo-map" ${state.documentHistory.length ? "" : "disabled"}><span aria-hidden="true">↶</span> 撤销上一步</button>
    </aside>
  `;
}

function destinationOptions(state: AppState, movingNodeId?: string): string {
  if (!state.activeDocument) return "";
  return destinationEntries(state.activeDocument, movingNodeId).map((entry) =>
    `<option value="${entry.node.id}">${entry.path.map(escapeHtml).join(" / ")}</option>`).join("");
}

function luggageOptions(state: AppState): string {
  return state.activeDocument?.containers.map((luggage) => `<option value="${luggage.id}">${escapeHtml(luggage.name)}</option>`).join("") ?? "";
}

function renderAddForm(state: AppState, mode: Exclude<WorkspaceMode, "inspect">): string {
  const definitions = {
    "add-item": { title: "新增物品", label: "物品名称", button: "加入地图" },
    "add-bag": { title: "新增收纳袋", label: "收纳袋名称", button: "建立收纳袋" },
    "add-compartment": { title: "新增分区", label: "分区名称", button: "建立分区" },
    "add-luggage": { title: "新增箱包", label: "箱包名称", button: "建立箱包" },
  } as const;
  const definition = definitions[mode];
  const needsDestination = mode === "add-item" || mode === "add-bag";
  return `
    <section class="map-editor">
      <header><div><span>CREATE</span><h2>${definition.title}</h2></div><button type="button" data-close-editor aria-label="关闭">×</button></header>
      <form class="map-editor-form" data-create-mode="${mode}">
        <label>${definition.label}<input name="name" required autocomplete="off"></label>
        ${mode === "add-item" ? '<label>数量<input name="quantity" value="1 件"></label><label>备注<textarea name="notes" rows="3"></textarea></label>' : ""}
        ${needsDestination ? `<label>放入位置<select name="parentId" required>${destinationOptions(state)}</select></label>` : ""}
        ${mode === "add-compartment" ? `<label>所属箱包<select name="parentId" required>${luggageOptions(state)}</select></label>` : ""}
        ${mode === "add-luggage" ? '<label>运输角色<select name="transport"><option value="checked">托运</option><option value="carry-on">随身</option><option value="none">未指定</option></select></label>' : ""}
        <button class="primary-button" type="submit">${definition.button}</button>
      </form>
    </section>
  `;
}

function renderNodeEditor(state: AppState, entry: MapEntry): string {
  const node = entry.node;
  return `
    <section class="map-editor">
      <header><div><span>${NODE_LABELS[node.type].toUpperCase()}</span><h2>${escapeHtml(node.name)}</h2></div><button type="button" data-close-editor aria-label="关闭">×</button></header>
      <p class="editor-path">${entry.path.map(escapeHtml).join(" / ")}</p>
      <form class="map-editor-form" data-update-node="${node.id}">
        <label>名称<input name="name" value="${escapeHtml(node.name)}" required></label>
        ${node.type === "item" ? `
          <label>数量<input name="quantity" value="${escapeHtml(node.quantity)}"></label>
          <label>备注<textarea name="notes" rows="3">${escapeHtml(node.notes ?? "")}</textarea></label>
          <label>移动到<select name="targetId"><option value="">保持当前位置</option>${destinationOptions(state, node.id)}</select></label>
        ` : ""}
        ${node.type === "bag" ? `<label>移动到<select name="targetId"><option value="">保持当前位置</option>${destinationOptions(state, node.id)}</select></label>` : ""}
        ${node.type === "luggage" ? `<label>运输角色<select name="transport">
          ${Object.entries(TRANSPORT_LABELS).map(([value, label]) => `<option value="${value}" ${node.transport === value ? "selected" : ""}>${label}</option>`).join("")}
        </select></label>` : ""}
        <button class="primary-button" type="submit">保存修改</button>
      </form>
      <button class="danger-button" type="button" data-delete-node="${node.id}">删除${NODE_LABELS[node.type]}</button>
    </section>
  `;
}

function renderInspector(state: AppState): string {
  const document = state.activeDocument;
  if (!document) return "";
  const stats = packingStats(document);
  const selectedEntry = state.selectedMapNodeId ? findMapEntry(document, state.selectedMapNodeId) : undefined;
  const editor = state.workspaceMode !== "inspect"
    ? renderAddForm(state, state.workspaceMode)
    : selectedEntry
      ? renderNodeEditor(state, selectedEntry)
      : "";
  return `
    <aside class="workspace-inspector">
      <section class="packing-progress">
        <header><strong>打包进度</strong><span>${stats.packedItems}/${stats.totalItems}</span></header>
        <div class="packing-progress__meter" style="--packing-progress: ${stats.percentage}%"><strong>${stats.percentage}%</strong></div>
        <div class="packing-progress__legend"><span><i></i>已装 ${stats.packedItems}</span><span><i></i>待装 ${stats.unpackedItems}</span></div>
        <div class="packing-progress__actions">
          <button type="button" data-set-all-packed="true">全部装入</button>
          <button type="button" data-set-all-packed="false">全部重置</button>
        </div>
      </section>
      ${editor || `
        <section class="location-ledger">
          <header>位置账本</header>
          <dl>
            <div><dt>箱包</dt><dd>${document.containers.length}</dd></div>
            <div><dt>分区</dt><dd>${flattenMap(document.containers).filter((entry) => entry.node.type === "compartment").length}</dd></div>
            <div><dt>收纳袋</dt><dd>${flattenMap(document.containers).filter((entry) => entry.node.type === "bag").length}</dd></div>
            <div><dt>随身要求</dt><dd>${flattenMap(document.containers).filter((entry) => entry.node.type === "item" && entry.node.transportRule === "carry-on").length}</dd></div>
          </dl>
        </section>
      `}
    </aside>
  `;
}

export function renderWorkspace(state: AppState): string {
  const document = state.activeDocument;
  if (!document) return "";
  const matchedIds = new Set(searchPackingMap(document, state.workspaceSearch).map((entry) => entry.node.id));
  return `
    <main class="packing-workspace">
      <section class="workspace-titlebar">
        <div><span class="eyebrow">ACTIVE PACKING MAP / ${document.schemaVersion}</span><h1>${escapeHtml(document.trip.name)}</h1><p>${escapeHtml(document.trip.origin)} → ${document.trip.destinations.map(escapeHtml).join("、")}</p></div>
        <div><button class="quiet-button" type="button" data-action="review-candidates">重新筛选</button><button class="quiet-button" type="button" data-action="edit-trip">编辑旅行</button></div>
      </section>
      <section class="packing-workspace-grid">
        ${renderInventory(state)}
        <section class="packing-canvas" aria-label="箱包收纳地图">
          <header><div><span>PACKING BOARD</span><strong>${document.containers.length} 个箱包</strong></div><small>拖放已开启</small></header>
          <div class="packing-canvas__cases">${renderLuggage(state, matchedIds)}</div>
        </section>
        ${renderInspector(state)}
      </section>
    </main>
  `;
}

function formValue(form: HTMLFormElement, name: string): string {
  return String(new FormData(form).get(name) ?? "").trim();
}

function scrollToMapNode(root: HTMLElement, nodeId: string): void {
  requestAnimationFrame(() => root.querySelector<HTMLElement>(`[data-map-node-id="${CSS.escape(nodeId)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
}

export function bindWorkspaceEvents(root: HTMLElement, store: AppStore): void {
  const search = root.querySelector<HTMLInputElement>("#workspaceSearch");
  search?.addEventListener("input", () => store.dispatch({ type: "SET_WORKSPACE_SEARCH", query: search.value }));
  root.querySelector<HTMLElement>("[data-clear-search]")?.addEventListener("click", () => store.dispatch({ type: "SET_WORKSPACE_SEARCH", query: "" }));
  root.querySelectorAll<HTMLElement>("[data-search-category]").forEach((button) => button.addEventListener("click", () =>
    store.dispatch({ type: "SET_WORKSPACE_SEARCH", query: button.dataset.searchCategory ?? "" })));

  root.querySelectorAll<HTMLElement>("[data-search-result]").forEach((button) => button.addEventListener("click", () => {
    const nodeId = button.dataset.searchResult ?? "";
    store.dispatch({ type: "SELECT_MAP_NODE", nodeId });
    scrollToMapNode(root, nodeId);
  }));
  root.querySelectorAll<HTMLElement>("[data-select-node]").forEach((button) => button.addEventListener("click", () =>
    store.dispatch({ type: "SELECT_MAP_NODE", nodeId: button.dataset.selectNode ?? null })));
  root.querySelectorAll<HTMLElement>("[data-pack-id]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    store.dispatch({ type: "TOGGLE_PACKED_ITEM", itemId: button.dataset.packId ?? "" });
  }));
  root.querySelectorAll<HTMLElement>("[data-collapse-id]").forEach((button) => button.addEventListener("click", () =>
    store.dispatch({ type: "TOGGLE_COLLAPSED_NODE", nodeId: button.dataset.collapseId ?? "" })));
  root.querySelectorAll<HTMLElement>("[data-workspace-mode]").forEach((button) => button.addEventListener("click", () =>
    store.dispatch({ type: "SET_WORKSPACE_MODE", mode: button.dataset.workspaceMode as WorkspaceMode })));
  root.querySelector<HTMLElement>("[data-close-editor]")?.addEventListener("click", () => {
    store.dispatch({ type: "SELECT_MAP_NODE", nodeId: null });
    store.dispatch({ type: "SET_WORKSPACE_MODE", mode: "inspect" });
  });
  root.querySelector<HTMLElement>('[data-action="undo-map"]')?.addEventListener("click", () => store.dispatch({ type: "UNDO_MAP_CHANGE" }));
  root.querySelectorAll<HTMLElement>("[data-set-all-packed]").forEach((button) => button.addEventListener("click", () =>
    store.dispatch({ type: "SET_ALL_PACKED", packed: button.dataset.setAllPacked === "true" })));

  root.querySelector<HTMLFormElement>("[data-create-mode]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const mode = form.dataset.createMode as Exclude<WorkspaceMode, "inspect">;
    const name = formValue(form, "name");
    let input: NewMapNode;
    if (mode === "add-luggage") input = { type: "luggage", name, transport: formValue(form, "transport") as ContainerTransport };
    else if (mode === "add-compartment") input = { type: "compartment", name, parentId: formValue(form, "parentId") };
    else if (mode === "add-bag") input = { type: "bag", name, parentId: formValue(form, "parentId") };
    else input = { type: "item", name, quantity: formValue(form, "quantity"), notes: formValue(form, "notes"), parentId: formValue(form, "parentId") };
    store.dispatch({ type: "ADD_MAP_NODE", input });
  });

  root.querySelector<HTMLFormElement>("[data-update-node]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const nodeId = form.dataset.updateNode ?? "";
    const entry = store.getState().activeDocument ? findMapEntry(store.getState().activeDocument!, nodeId) : undefined;
    if (!entry) return;
    const patch = { name: formValue(form, "name") };
    if (entry.node.type === "item") Object.assign(patch, { quantity: formValue(form, "quantity"), notes: formValue(form, "notes") });
    if (entry.node.type === "luggage") Object.assign(patch, { transport: formValue(form, "transport") as ContainerTransport });
    store.dispatch({ type: "UPDATE_MAP_NODE", nodeId, patch });
    const targetId = formValue(form, "targetId");
    if (targetId) store.dispatch({ type: "MOVE_MAP_NODE", nodeId, targetId });
  });

  root.querySelector<HTMLElement>("[data-delete-node]")?.addEventListener("click", (event) => {
    const nodeId = (event.currentTarget as HTMLElement).dataset.deleteNode ?? "";
    const document = store.getState().activeDocument;
    const entry = document ? findMapEntry(document, nodeId) : undefined;
    if (entry && window.confirm(`确定删除“${entry.node.name}”及其内部内容吗？`)) store.dispatch({ type: "DELETE_MAP_NODE", nodeId });
  });

  root.querySelectorAll<HTMLElement>("[data-drag-node]").forEach((element) => {
    element.addEventListener("dragstart", (event) => {
      event.dataTransfer?.setData("text/plain", element.dataset.dragNode ?? "");
      event.dataTransfer?.setDragImage(element, 24, 24);
      element.classList.add("is-dragging");
    });
    element.addEventListener("dragend", () => {
      element.classList.remove("is-dragging");
      root.querySelectorAll(".is-drop-ready").forEach((target) => target.classList.remove("is-drop-ready"));
    });
  });
  root.querySelectorAll<HTMLElement>("[data-drop-target]").forEach((target) => {
    target.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.stopPropagation();
      target.classList.add("is-drop-ready");
    });
    target.addEventListener("dragleave", () => target.classList.remove("is-drop-ready"));
    target.addEventListener("drop", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const nodeId = event.dataTransfer?.getData("text/plain") ?? "";
      const targetId = target.dataset.dropTarget ?? "";
      target.classList.remove("is-drop-ready");
      store.dispatch({ type: "MOVE_MAP_NODE", nodeId, targetId });
    });
  });
}
