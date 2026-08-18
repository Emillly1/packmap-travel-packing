import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const target = await fetch("http://127.0.0.1:9222/json/new?http%3A%2F%2F127.0.0.1%3A4173%2F", { method: "PUT" }).then((response) => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let commandId = 0;

await new Promise((resolveOpen, reject) => {
  socket.addEventListener("open", resolveOpen, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  if (message.error) request.reject(new Error(message.error.message));
  else request.resolve(message.result);
});

function command(method, params = {}) {
  const id = ++commandId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolveCommand, reject) => pending.set(id, { resolve: resolveCommand, reject }));
}

async function evaluate(expression) {
  const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function waitFor(expression, message) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 80));
  }
  throw new Error(message);
}

async function screenshot(name) {
  const dimensions = await evaluate(`({
    width: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)
  })`);
  const output = await command("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: dimensions.width, height: dimensions.height, scale: 1 },
  });
  writeFileSync(resolve("artifacts", name), Buffer.from(output.data, "base64"));
}

await command("Page.enable");
await command("Runtime.enable");
await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await waitFor('document.querySelector("#app")', "PackMap app did not load");
await evaluate("localStorage.clear(); location.reload()");
await waitFor('document.querySelector("[data-template=city]")', "Fresh template screen did not load");

await evaluate('document.querySelector("[data-template=city]").click()');
await waitFor('document.querySelector("#tripName")', "Trip step did not open");
await evaluate(`
  document.querySelector("#tripName").value = "秋日意大利测试";
  document.querySelector("#origin").value = "上海";
  document.querySelector("#destinations").value = "罗马、佛罗伦萨、威尼斯";
  document.querySelector("#startDate").value = "2026-09-10";
  document.querySelector("#endDate").value = "2026-09-20";
  document.querySelector("#travelers").value = "2";
  document.querySelector("[data-action=next]").click();
`);
await waitFor('document.querySelector("#transportNotes")', "Transport step did not open");
await evaluate(`
  document.querySelector("#transportNotes").value = "含廉航和多次火车换乘";
  document.querySelector("[data-action=next]").click();
`);
await waitFor('document.querySelector("#specialNeeds")', "Habits step did not open");
await evaluate(`
  document.querySelector("#specialNeeds").value = "正式晚餐、游泳、敏感肌，不徒步";
  document.querySelector("[data-action=next]").click();
`);
await waitFor('document.querySelector("#bagSetup")', "Luggage step did not open");
await evaluate(`
  document.querySelector("#bagSetup").value = "托运行李：开放面、袋子面\\n随身背包：主仓、前袋";
  document.querySelector("[data-action=next]").click();
`);
await waitFor('document.querySelector(".review-screen")', "Packing review did not open");

const reviewTitle = await evaluate('document.querySelector(".review-heading h1").textContent.trim()');
const candidateCount = await evaluate('document.querySelectorAll("[data-candidate-id]").length');
const hikingPresent = await evaluate('Boolean(document.querySelector("[data-candidate-id=hiking-shoes]"))');
if (reviewTitle !== "确认你的候选清单" || candidateCount < 20 || hikingPresent) {
  throw new Error(`Unexpected review result: ${reviewTitle}, ${candidateCount}, hiking=${hikingPresent}`);
}
const desktopOverflow = await evaluate("document.documentElement.scrollWidth > window.innerWidth");
if (desktopOverflow) throw new Error("Desktop review has horizontal overflow");

mkdirSync("artifacts", { recursive: true });
await screenshot("phase-4-review-desktop.png");

const optionalBefore = await evaluate('document.querySelector("[data-candidate-id=empty-water-bottle]")?.checked');
await evaluate('document.querySelector("[data-candidate-id=empty-water-bottle]")?.click()');
const optionalAfter = await evaluate('document.querySelector("[data-candidate-id=empty-water-bottle]")?.checked');
if (optionalBefore !== false || optionalAfter !== true) throw new Error("Candidate toggle did not persist");

await evaluate('document.querySelector("[data-action=confirm-candidates]").click()');
await waitFor('document.querySelector(".packing-workspace")', "Workspace did not open after confirmation");
const mappedItems = await evaluate('document.querySelectorAll(".map-item").length');
const luggageCount = await evaluate('document.querySelectorAll(".packing-case").length');
if (mappedItems < 20 || luggageCount !== 2) throw new Error("Packing map was not materialized correctly");

await evaluate(`
  document.querySelector("[data-workspace-mode=add-bag]").click();
`);
await waitFor('document.querySelector("[data-create-mode=add-bag]")', "Pouch editor did not open");
await evaluate(`
  (() => {
    const form = document.querySelector("[data-create-mode=add-bag]");
    form.querySelector("[name=name]").value = "证件收纳袋";
    form.requestSubmit();
  })()
`);
await waitFor('[...document.querySelectorAll(".pouch-title strong")].some((node) => node.textContent === "证件收纳袋")', "Pouch was not created");

await evaluate(`
  const source = document.querySelector("[data-drag-node=identity-documents]");
  const target = document.querySelector("[data-drop-target=luggage-1-compartment-2]");
  const transfer = new DataTransfer();
  source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: transfer }));
  target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: transfer }));
  target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
`);
await evaluate(`
  const input = document.querySelector("#workspaceSearch");
  input.value = "身份证件";
  input.dispatchEvent(new Event("input", { bubbles: true }));
`);
await waitFor('document.querySelector(".search-result small")?.textContent.includes("袋子面")', "Search did not report the moved item path");
const movedPath = await evaluate('document.querySelector(".search-result small").textContent.trim()');
await evaluate('document.querySelector("[data-clear-search]").click()');

await evaluate('document.querySelector("[data-workspace-mode=add-item]").click()');
await waitFor('document.querySelector("[data-create-mode=add-item]")', "Item editor did not open");
await evaluate(`
  (() => {
    const form = document.querySelector("[data-create-mode=add-item]");
    form.querySelector("[name=name]").value = "备用框架眼镜";
    form.querySelector("[name=quantity]").value = "1 副";
    form.querySelector("[name=parentId]").value = "luggage-2-compartment-1";
    form.requestSubmit();
  })()
`);
await waitFor('[...document.querySelectorAll(".map-item strong")].some((node) => node.textContent === "备用框架眼镜")', "Custom item was not created");
const customItemId = await evaluate('[...document.querySelectorAll(".map-item")].find((node) => node.textContent.includes("备用框架眼镜")).dataset.mapNodeId');
await evaluate(`document.querySelector("[data-pack-id='${customItemId}']").click()`);
await waitFor(`document.querySelector("[data-map-node-id='${customItemId}']")?.classList.contains("is-packed")`, "Packed status did not update");
await evaluate('document.querySelector("[data-action=undo-map]").click()');
await waitFor(`!document.querySelector("[data-map-node-id='${customItemId}']")?.classList.contains("is-packed")`, "Undo did not restore packed status");

const desktopWorkspaceOverflow = await evaluate("document.documentElement.scrollWidth > window.innerWidth");
if (desktopWorkspaceOverflow) throw new Error("Desktop workspace has horizontal overflow");
await screenshot("phase-4-workspace-desktop.png");

await evaluate('document.querySelector("[data-workspace-view=safety]").click()');
await waitFor('document.querySelector(".safety-view")', "Safety view did not open");
const warningCount = await evaluate('document.querySelectorAll(".warning-row").length');
const highWarningCount = await evaluate('document.querySelectorAll(".warning-row--high").length');
if (warningCount < 2 || highWarningCount < 1) throw new Error("Transport safety conflicts were not detected");
await evaluate('document.querySelector("[data-warning-id]").click()');
await waitFor('document.querySelector(".warning-row.is-acknowledged")', "Warning acknowledgement did not persist");
await screenshot("phase-4-safety-desktop.png");

await evaluate('document.querySelector("[data-workspace-view=departure]").click()');
await waitFor('document.querySelector(".departure-view")', "Departure view did not open");
const departureTotal = await evaluate('document.querySelectorAll("[data-departure-check]").length');
await evaluate('document.querySelector("[data-departure-check]").click()');
await waitFor('document.querySelector(".departure-check.is-checked")', "Departure check did not persist");

await evaluate('document.querySelector("[data-workspace-view=data]").click()');
await waitFor('document.querySelector(".data-view")', "Data view did not open");
await evaluate(`
  (() => {
    const form = document.querySelector("[data-import-paste]");
    form.querySelector("textarea").value = "not-json";
    form.requestSubmit();
  })()
`);
await waitFor('document.querySelector(".data-error")?.textContent.includes("有效的 JSON")', "Malformed import did not fail safely");
const titleAfterInvalidImport = await evaluate('document.querySelector(".workspace-titlebar h1").textContent.trim()');
if (titleAfterInvalidImport !== "秋日意大利测试") throw new Error("Malformed import overwrote the active trip");

await evaluate(`
  (() => {
    window.confirm = () => true;
    const state = JSON.parse(localStorage.getItem("packmap.app-state.v2"));
    const imported = structuredClone(state.activeDocument);
    imported.trip.name = "导入恢复测试";
    const form = document.querySelector("[data-import-paste]");
    form.querySelector("textarea").value = JSON.stringify(imported);
    form.requestSubmit();
  })()
`);
await waitFor('document.querySelector(".workspace-titlebar h1")?.textContent.trim() === "导入恢复测试"', "Valid import did not replace the trip");
await evaluate('document.querySelector("[data-workspace-view=data]").click()');
await waitFor('!document.querySelector("[data-action=restore-import-backup]").disabled', "Import backup was not created");
await evaluate('document.querySelector("[data-action=restore-import-backup]").click()');
await waitFor('document.querySelector(".workspace-titlebar h1")?.textContent.trim() === "秋日意大利测试"', "Import backup restore failed");

await evaluate('document.querySelector("[data-workspace-view=data]").click()');
await command("Emulation.setEmulatedMedia", { media: "print" });
await waitFor('getComputedStyle(document.querySelector(".print-sheet")).display === "block"', "Print sheet did not render");
await screenshot("phase-4-print.png");
const printPdf = await command("Page.printToPDF", {
  printBackground: true,
  preferCSSPageSize: true,
  paperWidth: 8.27,
  paperHeight: 11.69,
});
writeFileSync(resolve("artifacts", "phase-4-print.pdf"), Buffer.from(printPdf.data, "base64"));
await command("Emulation.setEmulatedMedia", { media: "screen" });

await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await evaluate('document.querySelector("[data-workspace-view=safety]").click()');
await waitFor('document.querySelector(".safety-view")', "Mobile safety view did not open");
const mobileOverflow = await evaluate("document.documentElement.scrollWidth > window.innerWidth");
if (mobileOverflow) throw new Error("Mobile safety view has horizontal overflow");
await screenshot("phase-4-safety-mobile.png");

console.log(JSON.stringify({
  reviewTitle,
  candidateCount,
  hikingPresent,
  mappedItems,
  luggageCount,
  movedPath,
  desktopOverflow,
  desktopWorkspaceOverflow,
  warningCount,
  highWarningCount,
  departureTotal,
  titleAfterInvalidImport,
  mobileOverflow,
  screenshots: 5,
  printPdf: "artifacts/phase-4-print.pdf",
}, null, 2));
socket.close();
