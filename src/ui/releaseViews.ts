import { findMapEntry, flattenMap, packingStats } from "../engine/packingMap";
import {
  PackMapImportError,
  importPackMapText,
  serializeDocumentJson,
  serializeDocumentText,
} from "../engine/portability";
import type { DepartureCheck, PackingWarning } from "../models/packing";
import type { AppState, AppStore, WorkspaceView } from "../state/store";

const VIEW_LABELS: Array<{ id: WorkspaceView; label: string }> = [
  { id: "map", label: "收纳地图" },
  { id: "safety", label: "安全检查" },
  { id: "departure", label: "出发清单" },
  { id: "data", label: "数据与打印" },
];

const SEVERITY_LABELS: Record<PackingWarning["severity"], string> = {
  high: "优先处理",
  medium: "需要确认",
  low: "建议优化",
};

const CHECK_GROUP_LABELS: Record<NonNullable<DepartureCheck["group"]>, string> = {
  carry: "临出门随身",
  documents: "证件与资料",
  transport: "交通与行李",
  arrival: "落地与第一晚",
  home: "离家检查",
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderWorkspaceTabs(state: AppState): string {
  const pendingWarnings = state.activeDocument?.warnings.filter((warning) => !warning.acknowledged).length ?? 0;
  const pendingChecks = state.activeDocument?.departureChecks.filter((check) => !check.checked).length ?? 0;
  return `
    <nav class="workspace-view-tabs" aria-label="工作台视图">
      ${VIEW_LABELS.map((view) => {
        const count = view.id === "safety" ? pendingWarnings : view.id === "departure" ? pendingChecks : null;
        return `<button type="button" data-workspace-view="${view.id}" class="${state.workspaceView === view.id ? "is-active" : ""}">${view.label}${count !== null ? `<span>${count}</span>` : ""}</button>`;
      }).join("")}
    </nav>
  `;
}

function warningLocation(state: AppState, warning: PackingWarning): string {
  if (!state.activeDocument || !warning.itemId) return "行程级提醒";
  return findMapEntry(state.activeDocument, warning.itemId)?.path.join(" / ") ?? "物品位置已变化";
}

function renderSafetyView(state: AppState): string {
  const document = state.activeDocument;
  if (!document) return "";
  const warnings = [...document.warnings].sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 };
    return Number(a.acknowledged) - Number(b.acknowledged) || rank[a.severity] - rank[b.severity];
  });
  const open = warnings.filter((warning) => !warning.acknowledged);
  return `
    <section class="safety-view">
      <header class="aux-view-heading">
        <div><span>TRANSPORT AUDIT</span><h2>安全检查</h2><p>航空、机场与铁路规则可能随承运人和地点变化，最终以官方要求为准。</p></div>
        <div class="audit-totals"><strong>${open.length}</strong><span>项待确认</span></div>
      </header>
      <div class="safety-summary">
        <div><span>优先处理</span><strong>${open.filter((warning) => warning.severity === "high").length}</strong></div>
        <div><span>需要确认</span><strong>${open.filter((warning) => warning.severity === "medium").length}</strong></div>
        <div><span>建议优化</span><strong>${open.filter((warning) => warning.severity === "low").length}</strong></div>
        <div><span>已知悉</span><strong>${warnings.filter((warning) => warning.acknowledged).length}</strong></div>
      </div>
      <div class="warning-list">
        ${warnings.length ? warnings.map((warning) => `
          <article class="warning-row warning-row--${warning.severity} ${warning.acknowledged ? "is-acknowledged" : ""}">
            <div class="warning-level"><i></i><span>${SEVERITY_LABELS[warning.severity]}</span></div>
            <div class="warning-copy">
              <div><strong>${escapeHtml(warning.itemName ?? "旅行安排")}</strong><small>${escapeHtml(warningLocation(state, warning))}</small></div>
              <p>${escapeHtml(warning.issue)}</p>
              ${warning.suggestedAction ? `<b>${escapeHtml(warning.suggestedAction)}</b>` : ""}
            </div>
            <div class="warning-actions">
              ${warning.itemId ? `<button type="button" data-warning-item="${warning.itemId}">查看位置</button>` : ""}
              <button type="button" data-warning-id="${warning.id}">${warning.acknowledged ? "恢复待处理" : "我已知悉"}</button>
            </div>
          </article>
        `).join("") : '<div class="audit-empty"><strong>当前没有位置冲突</strong><span>安全结果会随物品位置自动更新。</span></div>'}
      </div>
    </section>
  `;
}

function renderDepartureView(state: AppState): string {
  const document = state.activeDocument;
  if (!document) return "";
  const completed = document.departureChecks.filter((check) => check.checked).length;
  const total = document.departureChecks.length;
  const percentage = total ? Math.round((completed / total) * 100) : 0;
  const groups = Object.entries(CHECK_GROUP_LABELS) as Array<[NonNullable<DepartureCheck["group"]>, string]>;
  return `
    <section class="departure-view">
      <header class="aux-view-heading">
        <div><span>FINAL CHECK / ${document.trip.startDate}</span><h2>出发清单</h2><p>${escapeHtml(document.trip.origin)} → ${document.trip.destinations.map(escapeHtml).join("、")}</p></div>
        <div class="departure-meter" style="--departure-progress: ${percentage}%"><strong>${percentage}%</strong><span>${completed}/${total}</span></div>
      </header>
      <div class="departure-groups">
        ${groups.map(([group, label], groupIndex) => {
          const checks = document.departureChecks.filter((check) => check.group === group);
          if (!checks.length) return "";
          return `
            <section class="departure-group departure-group--${groupIndex}">
              <header><span>0${groupIndex + 1}</span><h3>${label}</h3><b>${checks.filter((check) => check.checked).length}/${checks.length}</b></header>
              <div>${checks.map((check) => `
                <label class="departure-check ${check.checked ? "is-checked" : ""}">
                  <input type="checkbox" data-departure-check="${check.id}" ${check.checked ? "checked" : ""}>
                  <span aria-hidden="true">${check.checked ? "✓" : ""}</span>
                  <strong>${escapeHtml(check.name)}</strong>
                </label>
              `).join("")}</div>
            </section>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderDataView(state: AppState): string {
  const document = state.activeDocument;
  if (!document) return "";
  const stats = packingStats(document);
  return `
    <section class="data-view">
      <header class="aux-view-heading">
        <div><span>PORTABILITY / LOCAL FIRST</span><h2>数据与打印</h2><p>${stats.totalItems} 项物品 · ${document.containers.length} 个箱包 · 格式 ${document.schemaVersion}</p></div>
      </header>
      ${state.error ? `<p class="data-error" role="alert">${escapeHtml(state.error)}</p>` : ""}
      <div class="data-actions-grid">
        <section class="data-section">
          <header><span>01</span><h3>导出</h3></header>
          <div class="data-command"><div><strong>PackMap JSON</strong><small>完整结构，可无损恢复</small></div><button type="button" data-export-format="json">下载 JSON</button></div>
          <div class="data-command"><div><strong>可读 TXT</strong><small>目录清单与精确恢复载荷</small></div><button type="button" data-export-format="txt">下载 TXT</button></div>
          <div class="data-command"><div><strong>打印清单</strong><small>箱包位置、安全提醒与出发检查</small></div><button type="button" data-action="print-map">打印</button></div>
        </section>
        <section class="data-section">
          <header><span>02</span><h3>导入</h3></header>
          <label class="file-import"><input id="packmapFileInput" type="file" accept=".json,.txt,application/json,text/plain"><span>选择 JSON、TXT 或旧版文字地图</span></label>
          <form class="paste-import" data-import-paste>
            <label for="importText">粘贴内容</label>
            <textarea id="importText" name="importText" rows="7" placeholder="粘贴 PackMap JSON、TXT，或以缩进表示层级的旧版“欧洲行李位置地图”"></textarea>
            <button type="submit">识别并导入</button>
          </form>
        </section>
        <section class="data-section data-section--backup">
          <header><span>03</span><h3>恢复点</h3></header>
          <div class="backup-status"><i class="${state.importBackupAvailable ? "is-ready" : ""}"></i><div><strong>${state.importBackupAvailable ? "导入前备份可用" : "暂无导入备份"}</strong><small>导入只会在完整验证后替换当前旅行</small></div></div>
          <button class="restore-button" type="button" data-action="restore-import-backup" ${state.importBackupAvailable ? "" : "disabled"}>恢复导入前旅行</button>
        </section>
      </div>
    </section>
  `;
}

export function renderAuxiliaryView(state: AppState): string {
  if (state.workspaceView === "safety") return renderSafetyView(state);
  if (state.workspaceView === "departure") return renderDepartureView(state);
  if (state.workspaceView === "data") return renderDataView(state);
  return "";
}

export function renderPrintSheet(state: AppState): string {
  const document = state.activeDocument;
  if (!document) return "";
  const items = flattenMap(document.containers).filter((entry) => entry.node.type === "item");
  return `
    <section class="print-sheet">
      <header><div><span>PACKMAP / ${document.schemaVersion}</span><h1>${escapeHtml(document.trip.name)}</h1><p>${escapeHtml(document.trip.origin)} → ${document.trip.destinations.map(escapeHtml).join("、")} · ${document.trip.startDate} 至 ${document.trip.endDate}</p></div><strong>${items.length} 项</strong></header>
      <section><h2>行李位置地图</h2><table><thead><tr><th>状态</th><th>物品</th><th>数量</th><th>位置</th></tr></thead><tbody>
        ${items.map((entry) => entry.node.type === "item" ? `<tr><td>${entry.node.packed ? "已装" : "未装"}</td><td>${escapeHtml(entry.node.name)}</td><td>${escapeHtml(entry.node.quantity)}</td><td>${entry.path.slice(0, -1).map(escapeHtml).join(" / ")}</td></tr>` : "").join("")}
      </tbody></table></section>
      <section><h2>安全检查</h2>${document.warnings.length ? `<ul>${document.warnings.map((warning) => `<li><strong>${warning.acknowledged ? "已知悉" : SEVERITY_LABELS[warning.severity]}</strong> ${escapeHtml(warning.itemName ?? "行程")}：${escapeHtml(warning.issue)}</li>`).join("")}</ul>` : "<p>当前没有位置冲突。</p>"}</section>
      <section><h2>出发清单</h2><div class="print-checks">${document.departureChecks.map((check) => `<span>${check.checked ? "[完成]" : "[ ]"} ${escapeHtml(check.name)}</span>`).join("")}</div></section>
      <footer>导出时间：${new Date().toLocaleString("zh-CN")}</footer>
    </section>
  `;
}

function safeFilename(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, "-").trim() || "packmap";
}

function downloadText(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function importSource(store: AppStore, sourceText: string): void {
  try {
    const result = importPackMapText(sourceText);
    const itemCount = flattenMap(result.document.containers).filter((entry) => entry.node.type === "item").length;
    const format = result.sourceVersion === "prototype-text" ? "旧版文字位置地图" : `PackMap ${result.sourceVersion}`;
    const migrationNote = result.sourceVersion === "prototype-text" ? "\n旧称“袋子面”将自动改为“拉链面”，旅行资料可在导入后补充。" : "";
    if (!window.confirm(`已识别 ${format}：\n“${result.document.trip.name}”\n${result.document.containers.length} 个箱包 · ${itemCount} 项物品${migrationNote}\n\n导入将替换当前旅行，是否继续？`)) return;
    store.dispatch({ type: "IMPORT_DOCUMENT", document: result.document, sourceText, sourceVersion: result.sourceVersion, migrated: result.migrated });
  } catch (error) {
    const message = error instanceof PackMapImportError ? error.message : "导入失败，当前旅行未被修改。";
    store.dispatch({ type: "SET_ERROR", message });
  }
}

export function bindReleaseEvents(root: HTMLElement, store: AppStore): void {
  root.querySelectorAll<HTMLElement>("[data-workspace-view]").forEach((button) => button.addEventListener("click", () =>
    store.dispatch({ type: "SET_WORKSPACE_VIEW", view: button.dataset.workspaceView as WorkspaceView })));
  root.querySelectorAll<HTMLElement>("[data-warning-id]").forEach((button) => button.addEventListener("click", () =>
    store.dispatch({ type: "ACKNOWLEDGE_WARNING", warningId: button.dataset.warningId ?? "" })));
  root.querySelectorAll<HTMLElement>("[data-warning-item]").forEach((button) => button.addEventListener("click", () => {
    store.dispatch({ type: "SET_WORKSPACE_VIEW", view: "map" });
    store.dispatch({ type: "SELECT_MAP_NODE", nodeId: button.dataset.warningItem ?? null });
  }));
  root.querySelectorAll<HTMLInputElement>("[data-departure-check]").forEach((input) => input.addEventListener("change", () =>
    store.dispatch({ type: "TOGGLE_DEPARTURE_CHECK", checkId: input.dataset.departureCheck ?? "" })));

  root.querySelectorAll<HTMLElement>("[data-export-format]").forEach((button) => button.addEventListener("click", () => {
    const document = store.getState().activeDocument;
    if (!document) return;
    const base = safeFilename(document.trip.name);
    if (button.dataset.exportFormat === "json") downloadText(`${base}.packmap.json`, serializeDocumentJson(document), "application/json;charset=utf-8");
    else downloadText(`${base}.packmap.txt`, serializeDocumentText(document), "text/plain;charset=utf-8");
  }));
  root.querySelector<HTMLElement>('[data-action="print-map"]')?.addEventListener("click", () => window.print());
  root.querySelector<HTMLInputElement>("#packmapFileInput")?.addEventListener("change", async (event) => {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (file) importSource(store, await file.text());
  });
  root.querySelector<HTMLFormElement>("[data-import-paste]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    importSource(store, String(new FormData(form).get("importText") ?? ""));
  });
  root.querySelector<HTMLElement>('[data-action="restore-import-backup"]')?.addEventListener("click", () => {
    if (window.confirm("恢复将替换当前旅行，是否继续？")) store.dispatch({ type: "RESTORE_IMPORT_BACKUP" });
  });
}
