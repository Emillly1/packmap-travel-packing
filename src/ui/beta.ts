import { flattenMap } from "../engine/packingMap";
import { APP_VERSION } from "../release";
import type { AppStore } from "../state/store";

export function renderBetaChrome(): string {
  return `
    <footer class="app-release-footer">
      <span>PackMap ${APP_VERSION}</span>
      <div><button type="button" data-open-privacy>隐私与使用说明</button><button type="button" data-open-feedback>Beta 反馈</button></div>
    </footer>
    <dialog class="release-dialog" data-privacy-dialog aria-labelledby="privacy-title">
      <section class="release-dialog__shell">
        <header><div><span>LOCAL FIRST</span><h2 id="privacy-title">隐私与使用说明</h2></div><button type="button" data-close-release-dialog aria-label="关闭">×</button></header>
        <div class="release-dialog__body">
          <section><h3>数据留在这台设备</h3><p>当前版本没有账号、云同步或分析追踪。旅行资料保存在浏览器本地，只有你主动导出时才会生成文件。</p></section>
          <section><h3>安全提醒的边界</h3><p>航空、签证、医疗和限制物品提示只用于整理规划，不替代承运人、机场、政府或专业人士的最新要求。</p></section>
          <section><h3>本地数据控制</h3><p>清除操作会删除当前旅行、自动备份和导入恢复点，且无法撤销。需要保留时请先导出 JSON。</p></section>
        </div>
        <footer><button class="danger-button release-delete" type="button" data-delete-local-data>清除全部本地数据</button><button class="primary-button" type="button" data-close-release-dialog>完成</button></footer>
      </section>
    </dialog>
    <dialog class="release-dialog" data-feedback-dialog aria-labelledby="feedback-title">
      <form class="release-dialog__shell" data-feedback-form>
        <header><div><span>BETA FEEDBACK</span><h2 id="feedback-title">生成反馈摘要</h2></div><button type="button" data-close-release-dialog aria-label="关闭">×</button></header>
        <div class="release-dialog__body">
          <p>摘要只包含版本、页面、箱包与物品数量，不包含名称、目的地或具体行李内容。</p>
          <label>问题或建议<textarea name="message" rows="6" placeholder="请描述发生了什么，以及你原本希望怎样工作"></textarea></label>
        </div>
        <footer><button class="quiet-button" type="button" data-close-release-dialog>取消</button><button class="primary-button" type="submit">下载反馈摘要</button></footer>
      </form>
    </dialog>
  `;
}

function downloadFeedback(store: AppStore, message: string): void {
  const state = store.getState();
  const entries = state.activeDocument ? flattenMap(state.activeDocument.containers) : [];
  const lines = [
    "PACKMAP BETA FEEDBACK",
    `Version: ${APP_VERSION}`,
    `Generated: ${new Date().toISOString()}`,
    `Screen: ${state.screen}${state.screen === "workspace" ? ` / ${state.workspaceView}` : ""}`,
    `Luggage count: ${state.activeDocument?.containers.length ?? 0}`,
    `Item count: ${entries.filter((entry) => entry.node.type === "item").length}`,
    `Pouch count: ${entries.filter((entry) => entry.node.type === "bag").length}`,
    `Browser: ${navigator.userAgent}`,
    "",
    "User description:",
    message.trim() || "(not provided)",
  ];
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `packmap-feedback-${new Date().toISOString().slice(0, 10)}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

export function bindBetaEvents(root: HTMLElement, store: AppStore): void {
  const privacy = root.querySelector<HTMLDialogElement>("[data-privacy-dialog]");
  const feedback = root.querySelector<HTMLDialogElement>("[data-feedback-dialog]");
  root.querySelector<HTMLElement>("[data-open-privacy]")?.addEventListener("click", () => privacy?.showModal());
  root.querySelector<HTMLElement>("[data-open-feedback]")?.addEventListener("click", () => feedback?.showModal());
  root.querySelectorAll<HTMLElement>("[data-close-release-dialog]").forEach((button) => button.addEventListener("click", () => button.closest("dialog")?.close()));
  root.querySelectorAll<HTMLDialogElement>(".release-dialog").forEach((dialog) => dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  }));
  root.querySelector<HTMLElement>("[data-delete-local-data]")?.addEventListener("click", () => {
    if (window.confirm("确定清除当前旅行、自动备份和导入恢复点吗？此操作无法撤销。")) store.dispatch({ type: "DELETE_ALL_LOCAL_DATA" });
  });
  root.querySelector<HTMLFormElement>("[data-feedback-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    downloadFeedback(store, String(new FormData(event.currentTarget as HTMLFormElement).get("message") ?? ""));
    feedback?.close();
  });
}
