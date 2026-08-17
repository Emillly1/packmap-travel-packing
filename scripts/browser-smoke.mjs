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
await screenshot("phase-2-review-desktop.png");

const optionalBefore = await evaluate('document.querySelector("[data-candidate-id=empty-water-bottle]")?.checked');
await evaluate('document.querySelector("[data-candidate-id=empty-water-bottle]")?.click()');
const optionalAfter = await evaluate('document.querySelector("[data-candidate-id=empty-water-bottle]")?.checked');
if (optionalBefore !== false || optionalAfter !== true) throw new Error("Candidate toggle did not persist");

await evaluate('document.querySelector("[data-action=confirm-candidates]").click()');
await waitFor('document.querySelector(".workspace-screen")', "Workspace did not open after confirmation");
const confirmedItems = await evaluate('document.querySelectorAll(".confirmed-groups span").length');
if (confirmedItems < 20) throw new Error("Confirmed item summary is incomplete");
await screenshot("phase-2-workspace-desktop.png");

await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await evaluate('document.querySelector("[data-action=review-candidates]").click()');
await waitFor('document.querySelector(".review-screen")', "Mobile review did not open");
const mobileOverflow = await evaluate("document.documentElement.scrollWidth > window.innerWidth");
if (mobileOverflow) throw new Error("Mobile review has horizontal overflow");
await screenshot("phase-2-review-mobile.png");

console.log(JSON.stringify({ reviewTitle, candidateCount, hikingPresent, confirmedItems, desktopOverflow, mobileOverflow, screenshots: 3 }, null, 2));
socket.close();
