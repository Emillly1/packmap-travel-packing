import type { NewMapNode } from "../engine/packingMap";
import type { AppStore } from "../state/store";

export function renderContextAddDialog(): string {
  return `
    <dialog class="context-add-dialog" data-context-dialog>
      <form method="dialog" class="context-add-shell" data-context-add-form>
        <header><div><span>ADD IN PLACE</span><h2 data-context-title>添加物品</h2><p data-context-path></p></div><button type="button" data-context-close aria-label="关闭">×</button></header>
        <input type="hidden" name="type" value="item">
        <input type="hidden" name="parentId">
        <div class="context-add-fields">
          <label><span data-context-name-label>物品名称</span><input name="name" required autocomplete="off" placeholder="输入名称"></label>
          <label data-context-quantity>数量<input name="quantity" value="1 件"></label>
          <label data-context-notes>备注<textarea name="notes" rows="3" placeholder="可选"></textarea></label>
        </div>
        <footer><button class="quiet-button" type="button" data-context-close>取消</button><button class="primary-button" type="submit">添加</button></footer>
      </form>
    </dialog>
  `;
}

const TYPE_LABELS: Record<"item" | "bag" | "compartment", string> = {
  item: "物品",
  bag: "收纳袋",
  compartment: "区域",
};

export function bindContextAddEvents(root: HTMLElement, store: AppStore): void {
  const dialog = root.querySelector<HTMLDialogElement>("[data-context-dialog]");
  const form = dialog?.querySelector<HTMLFormElement>("[data-context-add-form]");
  if (!dialog || !form) return;

  root.querySelectorAll<HTMLElement>("[data-context-add]").forEach((button) => button.addEventListener("click", () => {
    const type = (button.dataset.contextType ?? "item") as "item" | "bag" | "compartment";
    const typeInput = form.elements.namedItem("type") as HTMLInputElement | null;
    const parentInput = form.elements.namedItem("parentId") as HTMLInputElement | null;
    if (typeInput) typeInput.value = type;
    if (parentInput) parentInput.value = button.dataset.contextParent ?? "";
    const title = dialog.querySelector<HTMLElement>("[data-context-title]");
    const path = dialog.querySelector<HTMLElement>("[data-context-path]");
    const nameLabel = dialog.querySelector<HTMLElement>("[data-context-name-label]");
    const quantity = dialog.querySelector<HTMLElement>("[data-context-quantity]");
    const notes = dialog.querySelector<HTMLElement>("[data-context-notes]");
    if (title) title.textContent = `添加${TYPE_LABELS[type]}`;
    if (path) path.textContent = button.dataset.contextPath ?? "";
    if (nameLabel) nameLabel.textContent = `${TYPE_LABELS[type]}名称`;
    if (quantity) quantity.hidden = type !== "item";
    if (notes) notes.hidden = type !== "item";
    const nameInput = form.elements.namedItem("name") as HTMLInputElement | null;
    if (nameInput) nameInput.value = "";
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    requestAnimationFrame(() => nameInput?.focus());
  }));

  root.querySelectorAll<HTMLElement>("[data-context-close]").forEach((button) => button.addEventListener("click", () => dialog.close()));
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = new FormData(form);
    const type = String(values.get("type")) as "item" | "bag" | "compartment";
    const name = String(values.get("name") ?? "");
    const parentId = String(values.get("parentId") ?? "");
    let input: NewMapNode;
    if (type === "item") {
      input = { type, name, parentId, quantity: String(values.get("quantity") ?? "1 件"), notes: String(values.get("notes") ?? "") };
    } else {
      input = { type, name, parentId };
    }
    store.dispatch({ type: "ADD_MAP_NODE", input });
  });
}
