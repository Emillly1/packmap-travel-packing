import { destinationEntries, findMapEntry, flattenMap } from "../engine/packingMap";
import type { BagNode, ItemNode } from "../models/packing";
import type { AppState, AppStore } from "../state/store";
import { bindContextAddEvents, renderContextAddDialog } from "./contextAdd";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function itemCount(nodes: Array<BagNode | ItemNode>): number {
  return nodes.reduce((count, node) => count + (node.type === "item" ? 1 : itemCount(node.children)), 0);
}

function moveOptions(state: AppState, nodeId: string): string {
  if (!state.activeDocument) return "";
  return destinationEntries(state.activeDocument, nodeId).map((entry) =>
    `<option value="${entry.node.id}">${entry.path.map(escapeHtml).join(" / ")}</option>`).join("");
}

function renderProposalItem(item: ItemNode): string {
  return `
    <button class="proposal-item" type="button" draggable="true" data-organize-drag="${item.id}" data-organize-item="${item.id}" title="点击调整位置 · ${escapeHtml(item.quantity)}">
      <span>${escapeHtml(item.name)}</span><small>${escapeHtml(item.quantity)}</small>
    </button>
  `;
}

function renderItemMoveDialog(state: AppState): string {
  const document = state.activeDocument;
  if (!document) return "";
  const options = destinationEntries(document).map((entry) =>
    `<option value="${entry.node.id}">${entry.path.map(escapeHtml).join(" / ")}</option>`).join("");
  return `
    <dialog class="context-add-dialog" data-organize-item-dialog>
      <form class="context-add-shell" data-organize-item-move-form>
        <header><div><span>MOVE ITEM</span><h2 data-organize-item-title>调整物品位置</h2><p>选择它应该放入的区域或收纳袋。</p></div><button type="button" data-close-item-dialog aria-label="关闭">×</button></header>
        <div class="context-add-fields">
          <input type="hidden" name="nodeId">
          <label>移动到<select name="targetId" required>${options}</select></label>
        </div>
        <footer><button class="quiet-button" type="button" data-close-item-dialog>取消</button><button class="primary-button" type="submit">确认移动</button></footer>
      </form>
    </dialog>
  `;
}

function renderProposalPouch(bag: BagNode, state: AppState, path: string[]): string {
  const total = itemCount(bag.children);
  const fullPath = [...path, bag.name];
  return `
    <article class="proposal-pouch" draggable="true" data-organize-drag="${bag.id}" data-organize-drop="${bag.id}">
      <header>
        <form data-organize-rename="${bag.id}"><input name="name" value="${escapeHtml(bag.name)}" aria-label="收纳袋名称"><button type="submit" title="保存名称" aria-label="保存名称">✓</button></form>
        <span>${total} 项</span>
        <select data-organize-move="${bag.id}" aria-label="移动 ${escapeHtml(bag.name)}"><option value="">移动到…</option>${moveOptions(state, bag.id)}</select>
        <button type="button" data-context-add data-context-type="item" data-context-parent="${bag.id}" data-context-path="${escapeHtml(fullPath.join(" / "))}" title="添加袋内物品" aria-label="添加袋内物品">＋</button>
        <button class="proposal-delete" type="button" data-organize-delete="${bag.id}" title="删除收纳袋" aria-label="删除收纳袋">×</button>
      </header>
      <div class="proposal-pouch__contents">
        ${bag.children.map((child) => child.type === "item" ? renderProposalItem(child) : renderProposalPouch(child, state, fullPath)).join("")}
        ${bag.children.length ? "" : '<span class="proposal-empty">空收纳袋</span>'}
      </div>
    </article>
  `;
}

export function renderOrganization(state: AppState): string {
  const document = state.activeDocument;
  if (!document) return "";
  const entries = flattenMap(document.containers);
  const pouchCount = entries.filter((entry) => entry.node.type === "bag").length;
  const itemEntries = entries.filter((entry) => entry.node.type === "item");
  const looseCount = itemEntries.filter((entry) => entry.parentId && findMapEntry(document, entry.parentId)?.node.type === "compartment").length;
  return `
    <main id="main-content" class="organization-screen" tabindex="-1">
      <header class="organization-heading">
        <div><span class="eyebrow">ORGANIZE / 03</span><h1>确认收纳方案</h1><p>${escapeHtml(document.trip.name)} · ${document.containers.length} 个箱包 · ${pouchCount} 个收纳袋</p></div>
        <button class="quiet-button" type="button" data-action="back-to-review">返回调整物品</button>
      </header>
      <section class="organization-layout">
        <div class="organization-board">
          ${document.containers.map((luggage, luggageIndex) => {
            const total = luggage.children.reduce((count, compartment) => count + itemCount(compartment.children), 0);
            const firstCompartment = luggage.children[0];
            return `
              <section class="proposal-luggage proposal-luggage--${luggageIndex % 4}">
                <header><div><span>0${luggageIndex + 1}</span><h2>${escapeHtml(luggage.name)}</h2></div><strong>${total} 项</strong><div class="proposal-add-actions">
                  ${firstCompartment ? `<button type="button" data-context-add data-context-type="item" data-context-parent="${firstCompartment.id}" data-context-path="${escapeHtml(`${luggage.name} / ${firstCompartment.name}`)}">＋ 物品</button><button type="button" data-context-add data-context-type="bag" data-context-parent="${firstCompartment.id}" data-context-path="${escapeHtml(`${luggage.name} / ${firstCompartment.name}`)}">＋ 收纳袋</button>` : `<button type="button" data-context-add data-context-type="compartment" data-context-parent="${luggage.id}" data-context-path="${escapeHtml(luggage.name)}">＋ 区域</button>`}
                </div></header>
                <div class="proposal-compartments">
                  ${luggage.children.map((compartment) => {
                    const path = [luggage.name, compartment.name];
                    return `
                      <section class="proposal-compartment" data-organize-drop="${compartment.id}">
                        <header><div><h3>${escapeHtml(compartment.name)}</h3><span>${itemCount(compartment.children)} 项</span></div><div>
                          <button type="button" data-context-add data-context-type="item" data-context-parent="${compartment.id}" data-context-path="${escapeHtml(path.join(" / "))}" title="添加物品">＋ 物品</button>
                          <button type="button" data-context-add data-context-type="bag" data-context-parent="${compartment.id}" data-context-path="${escapeHtml(path.join(" / "))}" title="添加收纳袋">＋ 收纳袋</button>
                        </div></header>
                        <div class="proposal-compartment__contents">
                          ${compartment.children.map((child) => child.type === "item" ? renderProposalItem(child) : renderProposalPouch(child, state, path)).join("")}
                          ${compartment.children.length ? "" : '<span class="proposal-empty">空区域</span>'}
                        </div>
                      </section>
                    `;
                  }).join("")}
                </div>
              </section>
            `;
          }).join("")}
        </div>
        <aside class="organization-summary">
          <header>方案概览</header>
          <dl><div><dt>物品</dt><dd>${itemEntries.length}</dd></div><div><dt>收纳袋</dt><dd>${pouchCount}</dd></div><div><dt>散放物品</dt><dd>${looseCount}</dd></div><div><dt>箱包</dt><dd>${document.containers.length}</dd></div></dl>
          <button class="primary-button" type="button" data-action="confirm-organization">确认方案并进入地图</button>
          <button class="quiet-button" type="button" data-action="back-to-review">返回物品清单</button>
        </aside>
      </section>
      ${renderContextAddDialog()}
      ${renderItemMoveDialog(state)}
    </main>
  `;
}

export function bindOrganizationEvents(root: HTMLElement, store: AppStore): void {
  bindContextAddEvents(root, store);
  root.querySelectorAll<HTMLElement>('[data-action="back-to-review"]').forEach((button) => button.addEventListener("click", () => store.dispatch({ type: "BACK_TO_REVIEW" })));
  root.querySelector<HTMLElement>('[data-action="confirm-organization"]')?.addEventListener("click", () => store.dispatch({ type: "CONFIRM_ORGANIZATION" }));
  root.querySelectorAll<HTMLFormElement>("[data-organize-rename]").forEach((form) => form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = String(new FormData(form).get("name") ?? "");
    store.dispatch({ type: "UPDATE_MAP_NODE", nodeId: form.dataset.organizeRename ?? "", patch: { name } });
  }));
  root.querySelectorAll<HTMLSelectElement>("[data-organize-move]").forEach((select) => select.addEventListener("change", () => {
    if (select.value) store.dispatch({ type: "MOVE_MAP_NODE", nodeId: select.dataset.organizeMove ?? "", targetId: select.value });
  }));
  root.querySelectorAll<HTMLElement>("[data-organize-delete]").forEach((button) => button.addEventListener("click", () => {
    if (window.confirm("移除收纳袋后，袋内物品会保留在当前区域。是否继续？")) store.dispatch({ type: "UNPACK_BAG", bagId: button.dataset.organizeDelete ?? "" });
  }));
  root.querySelectorAll<HTMLElement>("[data-organize-drag]").forEach((node) => node.addEventListener("dragstart", (event) => {
    event.stopPropagation();
    event.dataTransfer?.setData("text/plain", node.dataset.organizeDrag ?? "");
  }));
  root.querySelectorAll<HTMLElement>("[data-organize-drop]").forEach((target) => {
    target.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    target.addEventListener("drop", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const nodeId = event.dataTransfer?.getData("text/plain") ?? "";
      if (nodeId) store.dispatch({ type: "MOVE_MAP_NODE", nodeId, targetId: target.dataset.organizeDrop ?? "" });
    });
  });
  const itemDialog = root.querySelector<HTMLDialogElement>("[data-organize-item-dialog]");
  root.querySelectorAll<HTMLElement>("[data-organize-item]").forEach((button) => button.addEventListener("click", () => {
    const document = store.getState().activeDocument;
    const entry = document ? findMapEntry(document, button.dataset.organizeItem ?? "") : undefined;
    const form = itemDialog?.querySelector<HTMLFormElement>("[data-organize-item-move-form]");
    if (!entry || entry.node.type !== "item" || !form || !itemDialog) return;
    const nodeInput = form.elements.namedItem("nodeId") as HTMLInputElement | null;
    if (nodeInput) nodeInput.value = entry.node.id;
    const target = form.elements.namedItem("targetId") as HTMLSelectElement | null;
    if (target && entry.parentId) target.value = entry.parentId;
    const title = itemDialog.querySelector<HTMLElement>("[data-organize-item-title]");
    if (title) title.textContent = `移动「${entry.node.name}」`;
    itemDialog.showModal();
  }));
  root.querySelectorAll<HTMLElement>("[data-close-item-dialog]").forEach((button) => button.addEventListener("click", () => itemDialog?.close()));
  itemDialog?.querySelector<HTMLFormElement>("[data-organize-item-move-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    store.dispatch({ type: "MOVE_MAP_NODE", nodeId: String(data.get("nodeId") ?? ""), targetId: String(data.get("targetId") ?? "") });
  });
}
