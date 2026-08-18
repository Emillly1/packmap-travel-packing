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
  document.querySelector("#bagSetup").value = "托运行李 A：开放面、拉链面\\n托运行李 B：开放面、拉链面\\n随身背包：主仓";
  document.querySelector("[data-action=next]").click();
`);
await waitFor('document.querySelector(".review-screen")', "Packing review did not open");

const reviewTitle = await evaluate('document.querySelector(".review-heading h1").textContent.trim()');
const candidateCount = await evaluate('document.querySelectorAll("[data-candidate-id]").length');
const hikingPresent = await evaluate('Boolean(document.querySelector("[data-candidate-id=hiking-shoes]"))');
if (reviewTitle !== "确认你的候选清单" || candidateCount < 20 || hikingPresent) {
  throw new Error(`Unexpected review result: ${reviewTitle}, ${candidateCount}, hiking=${hikingPresent}`);
}
await evaluate(`
  (() => {
    const form = document.querySelector("[data-add-custom-candidate]");
    form.querySelector("[name=name]").value = "便携热水袋";
    form.querySelector("[name=quantity]").value = "1 个";
    form.querySelector("[name=category]").value = "household";
    form.querySelector("[name=transportRule]").value = "checked";
    form.requestSubmit();
  })()
`);
await waitFor('[...document.querySelectorAll(".candidate-title strong")].some((node) => node.textContent === "便携热水袋")', "Custom review item was not added");
const candidateCountAfterCustom = await evaluate('document.querySelectorAll("[data-candidate-id]").length');
if (candidateCountAfterCustom !== candidateCount + 1) throw new Error("Custom candidate count did not update");
const desktopOverflow = await evaluate("document.documentElement.scrollWidth > window.innerWidth");
if (desktopOverflow) throw new Error("Desktop review has horizontal overflow");

mkdirSync("artifacts", { recursive: true });
await screenshot("phase-4-review-desktop.png");

const optionalBefore = await evaluate('document.querySelector("[data-candidate-id=empty-water-bottle]")?.checked');
await evaluate('document.querySelector("[data-candidate-id=empty-water-bottle]")?.click()');
const optionalAfter = await evaluate('document.querySelector("[data-candidate-id=empty-water-bottle]")?.checked');
if (optionalBefore !== false || optionalAfter !== true) throw new Error("Candidate toggle did not persist");

await evaluate('document.querySelector("[data-action=confirm-candidates]").click()');
await waitFor('document.querySelector(".organization-screen")', "Organization confirmation did not open");
const organizationPouchCount = await evaluate('document.querySelectorAll(".proposal-pouch").length');
if (organizationPouchCount < 5) throw new Error("Suggested pouch hierarchy was not generated");
const proposalPouchOverflow = await evaluate('[...document.querySelectorAll(".proposal-pouch")].some((node) => node.scrollWidth > node.clientWidth + 1)');
if (proposalPouchOverflow) throw new Error("Organization pouch controls overflow their containers");
const singleCompartmentFill = await evaluate(`
  (() => {
    const luggage = [...document.querySelectorAll(".proposal-luggage")].find((node) => node.querySelector("h2")?.textContent === "随身背包");
    const compartment = luggage?.querySelector(".proposal-compartment");
    const compartments = luggage?.querySelector(".proposal-compartments");
    return Boolean(compartment && compartments && compartment.getBoundingClientRect().width / compartments.getBoundingClientRect().width > 0.9);
  })()
`);
if (!singleCompartmentFill) throw new Error("A single compartment did not fill its luggage width");
if (!await evaluate('[...document.querySelectorAll(".proposal-item span")].some((node) => node.textContent === "便携热水袋")')) {
  throw new Error("Custom review item did not reach the organization proposal");
}
await evaluate(`
  (() => {
    const add = document.querySelector(".proposal-pouch [data-context-add]");
    add.click();
    const form = document.querySelector("[data-context-add-form]");
    form.querySelector("[name=name]").value = "方案确认便签";
    form.querySelector("[name=quantity]").value = "1 份";
    form.requestSubmit();
  })()
`);
await waitFor('[...document.querySelectorAll(".proposal-item span")].some((node) => node.textContent === "方案确认便签")', "Contextual add did not update the proposal");
await evaluate(`
  (() => {
    const form = document.querySelector("[data-organize-rename]");
    form.querySelector("[name=name]").value = "随身资料包";
    form.requestSubmit();
  })()
`);
await waitFor('document.querySelector("[data-organize-rename] input")?.value === "随身资料包"', "Pouch rename did not persist");
await evaluate('document.querySelector("[data-organize-item]").click()');
await waitFor('document.querySelector("[data-organize-item-dialog]").open', "Item destination dialog did not open");
const itemMoveDialogTitle = await evaluate('document.querySelector("[data-organize-item-title]").textContent.trim()');
if (!itemMoveDialogTitle.startsWith("移动「")) throw new Error("Item destination dialog did not identify the selected item");
await evaluate('document.querySelector("[data-close-item-dialog]").click()');
await screenshot("organization-confirm-desktop.png");
await evaluate('document.querySelector("[data-action=confirm-organization]").click()');
await waitFor('document.querySelector(".packing-workspace")', "Workspace did not open after confirmation");
const mappedItems = await evaluate('document.querySelectorAll(".map-item").length');
const luggageCount = await evaluate('document.querySelectorAll(".packing-case").length');
if (mappedItems < 20 || luggageCount !== 3) throw new Error("Packing map was not materialized correctly");
const checkedBagCounts = await evaluate(`
  [...document.querySelectorAll(".packing-case")].slice(0, 2).map((bag) => bag.querySelectorAll(".map-item").length)
`);
if (checkedBagCounts.some((count) => count === 0) || Math.abs(checkedBagCounts[0] - checkedBagCounts[1]) > 2) {
  throw new Error(`Checked luggage was not balanced: ${checkedBagCounts.join(", ")}`);
}
if (!await evaluate('[...document.querySelectorAll(".map-item strong")].some((node) => node.textContent === "便携热水袋")')) {
  throw new Error("Custom review item did not reach the packing map");
}
await evaluate('window.confirm = () => true; document.querySelector("[data-action=rebalance-map]").click()');
await waitFor('!document.querySelector("[data-action=undo-map]").disabled', "Rebalance did not create an undo step");

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
await waitFor('document.querySelector(".search-result small")?.textContent.includes("拉链面")', "Search did not report the moved item path");
const movedPath = await evaluate('document.querySelector(".search-result small").textContent.trim()');
await evaluate('document.querySelector("[data-clear-search]").click()');

await evaluate('[...document.querySelectorAll(".case-context-add")][1].click()');
await waitFor('document.querySelector("[data-context-dialog]").open', "Context item dialog did not open");
await evaluate(`
  (() => {
    const form = document.querySelector("[data-context-add-form]");
    form.querySelector("[name=name]").value = "备用框架眼镜";
    form.querySelector("[name=quantity]").value = "1 副";
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
    window.confirm = () => true;
    const legacyText = \`欧洲行李位置地图
导出时间：2026/8/12 15:33:59

新秀丽 28寸
  开放面
    夏季衣物包1
      [已装] 短袖 5件
      [未装] 干发帽
  袋子面
    [已装] 吹风机
25L双肩包
  主仓
    证件包
      [已装] 护照（必须随身）
待放入
  尚未归位
    [未装] 拖鞋\`;
    const form = document.querySelector("[data-import-paste]");
    form.querySelector("textarea").value = legacyText;
    form.requestSubmit();
  })()
`);
await waitFor('document.querySelector(".workspace-titlebar h1")?.textContent.trim() === "欧洲行李位置地图"', "Original organizer text was not imported");
await evaluate(`
  (() => {
    const input = document.querySelector("#workspaceSearch");
    input.value = "护照（必须随身）";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  })()
`);
await waitFor('document.querySelector(".search-result small")?.textContent.includes("证件包")', "Imported legacy hierarchy was not searchable");
const legacyImportedPath = await evaluate('document.querySelector(".search-result small").textContent.trim()');
await screenshot("legacy-text-import-desktop.png");
await evaluate('document.querySelector("[data-workspace-view=data]").click()');
await waitFor('!document.querySelector("[data-action=restore-import-backup]").disabled', "Legacy import did not create a backup");
await evaluate('document.querySelector("[data-action=restore-import-backup]").click()');
await waitFor('document.querySelector(".workspace-titlebar h1")?.textContent.trim() === "秋日意大利测试"', "Legacy import backup restore failed");
await evaluate('document.querySelector("[data-workspace-view=data]").click()');
await waitFor('document.querySelector(".data-view")', "Data view did not reopen after legacy restore");
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
await evaluate('document.querySelector("[data-action=review-candidates]").click()');
await waitFor('document.querySelector(".custom-candidate-form")', "Mobile review did not open");
const mobileReviewOverflow = await evaluate("document.documentElement.scrollWidth > window.innerWidth");
if (mobileReviewOverflow) throw new Error("Mobile custom candidate review has horizontal overflow");
await screenshot("feedback-review-mobile.png");
await evaluate('document.querySelector("[data-action=confirm-candidates]").click()');
await waitFor('document.querySelector(".organization-screen")', "Mobile organization confirmation did not open");
const mobileOrganizationOverflow = await evaluate("document.documentElement.scrollWidth > window.innerWidth");
if (mobileOrganizationOverflow) throw new Error("Mobile organization confirmation has horizontal overflow");
await screenshot("organization-confirm-mobile.png");

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
  mobileReviewOverflow,
  mobileOrganizationOverflow,
  checkedBagCounts,
  candidateCountAfterCustom,
  organizationPouchCount,
  proposalPouchOverflow,
  singleCompartmentFill,
  legacyImportedPath,
  itemMoveDialogTitle,
  screenshots: 9,
  printPdf: "artifacts/phase-4-print.pdf",
}, null, 2));
socket.close();
