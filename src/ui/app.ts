import { TRIP_TEMPLATES } from "../data/templates";
import { countSelectedCandidates, flattenCandidateItems } from "../engine/planning";
import { validateWizardStep } from "../engine/trip";
import { CATEGORY_LABELS, type CandidateItem, type PackingCategory } from "../models/planning";
import type { Recommendation, TransportRule } from "../models/packing";
import type { LaundryFrequency, TemplateId, TransportMode, TripDraft, TripType } from "../models/trip";
import type { AppState, AppStore } from "../state/store";
import { bindBetaEvents, renderBetaChrome } from "./beta";
import { bindOrganizationEvents, renderOrganization } from "./organization";
import { bindWorkspaceEvents, renderWorkspace } from "./workspace";

const WIZARD_STEPS = ["行程", "交通", "习惯", "箱包"] as const;

const TRANSPORT_OPTIONS: Array<{ id: TransportMode; name: string; note: string }> = [
  { id: "plane", name: "飞机", note: "随身与托运规则" },
  { id: "train", name: "火车", note: "换乘与轻装取用" },
  { id: "car", name: "自驾", note: "途中取用与后备箱" },
  { id: "ferry", name: "轮船", note: "过夜与甲板用品" },
];

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function splitBagSetup(value: string): Array<{ name: string; compartments: string[] }> {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, areas = "主区域"] = line.split(/[：:]/, 2);
      return {
        name: name.trim() || "未命名箱包",
        compartments: areas.split(/[、,，]/).map((entry) => entry.trim()).filter(Boolean),
      };
    });
}

function renderHeader(state: AppState): string {
  const status = state.screen === "review"
    ? "候选清单待确认"
    : state.screen === "organize"
      ? "收纳方案待确认"
    : state.activeDocument
      ? "旅行已保存"
      : state.screen === "wizard"
        ? "草稿自动保存"
        : "本地优先";
  return `
    <header class="app-header">
      <a class="brand" href="#" data-action="home" aria-label="PackMap 首页">
        <span class="brand-mark" aria-hidden="true"></span>
        <span>PACKMAP</span>
      </a>
      <div class="header-status"><span></span>${status}</div>
      ${state.activeDocument ? '<button class="quiet-button" type="button" data-action="new-trip">新建旅行</button>' : ""}
    </header>
  `;
}

function renderTemplatePreview(tone: string): string {
  return `
    <span class="mini-case mini-case--${tone}" aria-hidden="true">
      <i></i><i></i><i></i><i></i><i></i>
    </span>
  `;
}

function renderTemplates(): string {
  const featured = TRIP_TEMPLATES.filter((template) => template.id !== "blank");
  return `
    <main id="main-content" class="template-screen" tabindex="-1">
      <section class="template-intro" aria-labelledby="template-title">
        <div class="intro-copy">
          <span class="eyebrow">NEW TRIP / 01</span>
          <h1 id="template-title">从旅行结构开始，<br>而不是从一张空清单开始。</h1>
          <p>选择最接近的模板，再按你的行程调整。所有建议都可以筛选、移动和修改。</p>
          <button class="primary-button" type="button" data-template="city">开始规划</button>
        </div>
        <figure class="intro-art">
          <img src="/assets/packmap-editorial.jpg" alt="打开的行李箱、收纳分区和随身背包">
          <figcaption>PACKING STUDY NO. 01</figcaption>
        </figure>
      </section>

      <section class="template-library" aria-labelledby="library-title">
        <div class="section-heading">
          <div><span class="eyebrow">STARTING POINTS</span><h2 id="library-title">选择一个模板</h2></div>
          <button class="quiet-button" type="button" data-template="blank">＋ 从空白开始</button>
        </div>
        <div class="template-grid">
          ${featured.map((template) => `
            <button class="template-card" type="button" data-template="${template.id}">
              ${renderTemplatePreview(template.tone)}
              <span class="template-card__meta"><strong>${template.name}</strong><small>${template.durationHint}</small></span>
              <span>${template.description}</span>
            </button>
          `).join("")}
        </div>
      </section>
    </main>
  `;
}

function renderWizardNavigation(state: AppState): string {
  return `
    <aside class="wizard-nav" aria-label="规划步骤">
      <strong>新建旅行</strong>
      <ol>
        ${WIZARD_STEPS.map((step, index) => `
          <li class="${index === state.wizardStep ? "is-active" : ""}">
            <button type="button" data-step="${index}" ${index === state.wizardStep ? 'aria-current="step"' : ""} ${index > state.wizardStep ? "disabled" : ""}>
              <span>0${index + 1}</span>${step}
            </button>
          </li>
        `).join("")}
      </ol>
      <small>${state.selectedTemplate === "blank" ? "空白地图" : "模板可随时调整"}</small>
    </aside>
  `;
}

function renderTripStep(draft: TripDraft): string {
  return `
    <div class="form-grid">
      <label class="field field--full">旅行名称<input id="tripName" value="${escapeHtml(draft.name)}" autocomplete="off"></label>
      <label class="field">出发地<input id="origin" value="${escapeHtml(draft.origin)}" placeholder="上海"></label>
      <label class="field">目的地<input id="destinations" value="${escapeHtml(draft.destinationsText)}" placeholder="巴黎、里昂、米兰"></label>
      <label class="field">出发日期<input id="startDate" type="date" value="${draft.startDate}"></label>
      <label class="field">返回日期<input id="endDate" type="date" value="${draft.endDate}"></label>
      <label class="field field--compact">人数<input id="travelers" type="number" min="1" max="20" value="${draft.travelers}"></label>
    </div>
  `;
}

function renderTransportStep(draft: TripDraft): string {
  return `
    <fieldset class="transport-fieldset">
      <legend>会使用哪些出行方式？</legend>
      <div class="transport-grid">
        ${TRANSPORT_OPTIONS.map((option, index) => `
          <label class="transport-option">
            <input type="checkbox" name="transport" value="${option.id}" ${draft.transportModes.includes(option.id) ? "checked" : ""}>
            <span class="transport-number">0${index + 1}</span>
            <strong>${option.name}</strong>
            <small>${option.note}</small>
          </label>
        `).join("")}
      </div>
    </fieldset>
    <label class="field field--full">交通补充<textarea id="transportNotes" rows="4" placeholder="例如：廉航 8kg 随身限制、需要多次火车换乘">${escapeHtml(draft.transportNotes)}</textarea></label>
  `;
}

function renderHabitsStep(draft: TripDraft): string {
  return `
    <div class="form-grid">
      <label class="field">旅行类型
        <select id="tripType">
          <option value="leisure" ${draft.tripType === "leisure" ? "selected" : ""}>旅行 / 度假</option>
          <option value="study" ${draft.tripType === "study" ? "selected" : ""}>留学 / 交换</option>
          <option value="business" ${draft.tripType === "business" ? "selected" : ""}>出差 / 正式场合</option>
          <option value="outdoor" ${draft.tripType === "outdoor" ? "selected" : ""}>户外 / 徒步</option>
        </select>
      </label>
      <label class="field">洗衣频率
        <select id="laundryFrequency">
          <option value="often" ${draft.laundryFrequency === "often" ? "selected" : ""}>经常可洗</option>
          <option value="weekly" ${draft.laundryFrequency === "weekly" ? "selected" : ""}>每周一次</option>
          <option value="rare" ${draft.laundryFrequency === "rare" ? "selected" : ""}>不方便洗</option>
        </select>
      </label>
      <label class="field field--full">活动与个人需求
        <textarea id="specialNeeds" rows="7" placeholder="拍照、正式晚餐、游泳、敏感肌、儿童用品、医疗设备……">${escapeHtml(draft.specialNeeds)}</textarea>
      </label>
    </div>
  `;
}

function renderBagPreview(value: string): string {
  const roots = splitBagSetup(value);
  if (roots.length === 0) return '<p class="empty-preview">等待建立箱包目录</p>';
  return roots.map((root, index) => `
    <article class="directory-card">
      <span>0${index + 1}</span>
      <div><strong>${escapeHtml(root.name)}</strong><small>${root.compartments.map(escapeHtml).join(" · ")}</small></div>
    </article>
  `).join("");
}

function renderBagsStep(draft: TripDraft): string {
  return `
    <div class="bag-layout">
      <label class="field">一级目录：箱包与区域
        <textarea id="bagSetup" rows="12" placeholder="托运行李：开放面、拉链面&#10;随身背包：主仓、前袋">${escapeHtml(draft.bagSetup)}</textarea>
      </label>
      <section class="directory-preview" aria-live="polite">
        <strong>结构预览</strong>
        <div id="bagPreview">${renderBagPreview(draft.bagSetup)}</div>
      </section>
    </div>
  `;
}

function renderWizard(state: AppState): string {
  const titles = ["这次去哪里？", "路上怎么移动？", "你会怎样旅行？", "带哪些箱包？"];
  const body = [renderTripStep, renderTransportStep, renderHabitsStep, renderBagsStep][state.wizardStep](state.draft);
  return `
    <main id="main-content" class="wizard-screen" tabindex="-1">
      <div class="wizard-shell">
        ${renderWizardNavigation(state)}
        <section class="wizard-content">
          <header class="wizard-heading">
            <div><span>STEP 0${state.wizardStep + 1} / 04</span><h1>${titles[state.wizardStep]}</h1></div>
            <button class="icon-button" type="button" data-action="close-wizard" aria-label="关闭">×</button>
          </header>
          <div class="wizard-body">${body}</div>
          ${state.error ? `<p class="form-error" role="alert">${escapeHtml(state.error)}</p>` : ""}
          <footer class="wizard-actions">
            <button class="quiet-button" type="button" data-action="back" ${state.wizardStep === 0 ? "disabled" : ""}>上一步</button>
            <button class="primary-button" type="button" data-action="next">${state.wizardStep === 3 ? "创建旅行档案" : "下一步"}</button>
          </footer>
        </section>
      </div>
    </main>
  `;
}

const RECOMMENDATION_LABELS: Record<Recommendation, string> = {
  bring: "建议携带",
  "buy-local": "落地购买",
  optional: "可选",
  skip: "可不带",
};

const TRANSPORT_RULE_LABELS: Record<TransportRule, string> = {
  "carry-on": "随身",
  checked: "托运",
  none: "不限位置",
};

function renderCandidateItem(item: CandidateItem): string {
  return `
    <label class="candidate-item ${item.selected ? "is-selected" : ""}">
      <input type="checkbox" data-candidate-id="${item.id}" ${item.selected ? "checked" : ""}>
      <span class="candidate-check" aria-hidden="true">${item.selected ? "✓" : ""}</span>
      <span class="candidate-copy">
        <span class="candidate-title"><strong>${escapeHtml(item.name)}</strong><b>${escapeHtml(item.quantity)}</b></span>
        <small>${escapeHtml(item.reason)}</small>
        <span class="candidate-badges">
          ${item.custom ? '<i class="badge badge--custom">自定义</i>' : ""}
          <i class="badge badge--${item.recommendation}">${RECOMMENDATION_LABELS[item.recommendation]}</i>
          <i class="badge">${TRANSPORT_RULE_LABELS[item.transportRule]}</i>
          <i class="badge">${item.scope === "shared" ? "共享" : "每人"}</i>
        </span>
      </span>
    </label>
  `;
}

function renderReview(state: AppState): string {
  const result = state.planningResult;
  const document = state.activeDocument;
  if (!result || !document) return renderTemplates();
  const allItems = flattenCandidateItems(result);
  const selectedCount = countSelectedCandidates(result);
  const percentage = allItems.length ? Math.round((selectedCount / allItems.length) * 100) : 0;

  return `
    <main id="main-content" class="review-screen" tabindex="-1">
      <section class="review-heading">
        <div>
          <span class="eyebrow">PACKING REVIEW / 02</span>
          <h1>确认你的候选清单</h1>
          <p>${escapeHtml(document.trip.name)} · ${result.totalDays} 天 · ${result.travelers} 人 · 按 ${result.laundryCycleDays} 天洗衣周期计算</p>
        </div>
        <button class="quiet-button" type="button" data-action="edit-trip">返回修改行程</button>
      </section>

      <section class="review-grid">
        <nav class="review-categories" aria-label="物品分类">
          <header>分类</header>
          ${result.groups.map((group) => {
            const selected = group.items.filter((item) => item.selected).length;
            return `<a href="#candidate-${group.id}"><span>${escapeHtml(group.name)}</span><b>${selected}/${group.items.length}</b></a>`;
          }).join("")}
        </nav>

        <section class="review-list" aria-label="候选行李清单">
          <section class="custom-candidate-panel" id="custom-candidate">
            <header><div><span>ADD YOUR OWN</span><h2>添加自己的物品</h2></div><p>添加后会和推荐物品一起预打包。</p></header>
            <form class="custom-candidate-form" data-add-custom-candidate>
              <label class="custom-candidate-name">物品名称<input name="name" required autocomplete="off" placeholder="例如：卷发棒"></label>
              <label>数量<input name="quantity" value="1 件"></label>
              <label>分类<select name="category">${Object.entries(CATEGORY_LABELS).map(([id, name]) => `<option value="${id}">${escapeHtml(name)}</option>`).join("")}</select></label>
              <label>位置要求<select name="transportRule"><option value="none">不限位置</option><option value="carry-on">必须随身</option><option value="checked">建议托运</option></select></label>
              <button class="primary-button" type="submit">＋ 添加到清单</button>
            </form>
          </section>
          ${result.groups.map((group) => {
            const selected = group.items.filter((item) => item.selected).length;
            const allSelected = selected === group.items.length;
            return `
              <section class="candidate-group" id="candidate-${group.id}">
                <header>
                  <div><h2>${escapeHtml(group.name)}</h2><span>${selected} / ${group.items.length} 项</span></div>
                  <button class="group-toggle" type="button" data-group-id="${group.id}" data-group-selected="${allSelected}">${allSelected ? "全部取消" : "全部选择"}</button>
                </header>
                <div class="candidate-items">${group.items.map(renderCandidateItem).join("")}</div>
              </section>
            `;
          }).join("")}
        </section>

        <aside class="review-summary">
          <header>本次清单</header>
          <div class="review-progress" style="--progress: ${percentage}%">
            <strong>${percentage}%</strong>
            <span>已选择 ${selectedCount} / ${allItems.length} 项</span>
          </div>
          <dl>
            <div><dt>随身物品</dt><dd>${allItems.filter((item) => item.selected && item.transportRule === "carry-on").length}</dd></div>
            <div><dt>托运物品</dt><dd>${allItems.filter((item) => item.selected && item.transportRule === "checked").length}</dd></div>
            <div><dt>落地购买</dt><dd>${allItems.filter((item) => item.selected && item.recommendation === "buy-local").length}</dd></div>
          </dl>
          <button class="primary-button review-confirm" type="button" data-action="confirm-candidates" ${selectedCount === 0 ? "disabled" : ""}>下一步：规划收纳</button>
          <small>下一步确认收纳袋与箱包位置。</small>
        </aside>
      </section>
    </main>
  `;
}

function renderApp(root: HTMLElement, state: AppState): void {
  const screen = state.screen === "templates"
    ? renderTemplates()
    : state.screen === "wizard"
      ? renderWizard(state)
      : state.screen === "review"
        ? renderReview(state)
        : state.screen === "organize"
          ? renderOrganization(state)
          : renderWorkspace(state);
  root.innerHTML = `<a class="skip-link" href="#main-content">跳到主要内容</a>${renderHeader(state)}${screen}${renderBetaChrome()}<div class="status-region" role="status" aria-live="polite" aria-atomic="true">${escapeHtml(state.notice ?? "")}</div>`;
}

function inputValue(root: HTMLElement, selector: string): string {
  return root.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selector)?.value ?? "";
}

function syncWizardStep(root: HTMLElement, store: AppStore): void {
  const { wizardStep } = store.getState();
  if (wizardStep === 0) {
    store.dispatch({ type: "UPDATE_DRAFT", patch: {
      name: inputValue(root, "#tripName"),
      origin: inputValue(root, "#origin"),
      destinationsText: inputValue(root, "#destinations"),
      startDate: inputValue(root, "#startDate"),
      endDate: inputValue(root, "#endDate"),
      travelers: Number(inputValue(root, "#travelers")) || 1,
    } });
  }
  if (wizardStep === 1) {
    const transportModes = [...root.querySelectorAll<HTMLInputElement>('input[name="transport"]:checked')].map((entry) => entry.value as TransportMode);
    store.dispatch({ type: "UPDATE_DRAFT", patch: { transportModes, transportNotes: inputValue(root, "#transportNotes") } });
  }
  if (wizardStep === 2) {
    store.dispatch({ type: "UPDATE_DRAFT", patch: {
      tripType: inputValue(root, "#tripType") as TripType,
      laundryFrequency: inputValue(root, "#laundryFrequency") as LaundryFrequency,
      specialNeeds: inputValue(root, "#specialNeeds"),
    } });
  }
  if (wizardStep === 3) {
    store.dispatch({ type: "UPDATE_DRAFT", patch: { bagSetup: inputValue(root, "#bagSetup") } });
  }
}

function bindEvents(root: HTMLElement, store: AppStore): void {
  root.querySelectorAll<HTMLElement>("[data-template]").forEach((button) => {
    button.addEventListener("click", () => store.dispatch({ type: "START_TEMPLATE", templateId: button.dataset.template as TemplateId }));
  });

  root.querySelectorAll<HTMLButtonElement>("[data-step]").forEach((button) => {
    button.addEventListener("click", () => {
      syncWizardStep(root, store);
      store.dispatch({ type: "SET_WIZARD_STEP", step: Number(button.dataset.step) });
    });
  });

  root.querySelector<HTMLElement>('[data-action="next"]')?.addEventListener("click", () => {
    syncWizardStep(root, store);
    const state = store.getState();
    const result = validateWizardStep(state.wizardStep, state.draft);
    if (!result.valid) {
      store.dispatch({ type: "SET_ERROR", message: result.message ?? "请检查本页内容。" });
      return;
    }
    if (state.wizardStep === 3) store.dispatch({ type: "COMPLETE_SETUP" });
    else store.dispatch({ type: "SET_WIZARD_STEP", step: state.wizardStep + 1 });
  });

  root.querySelector<HTMLElement>('[data-action="back"]')?.addEventListener("click", () => {
    syncWizardStep(root, store);
    store.dispatch({ type: "SET_WIZARD_STEP", step: store.getState().wizardStep - 1 });
  });

  root.querySelector<HTMLElement>('[data-action="edit-trip"]')?.addEventListener("click", () => store.dispatch({ type: "EDIT_TRIP" }));
  root.querySelector<HTMLElement>('[data-action="review-candidates"]')?.addEventListener("click", () => store.dispatch({ type: "REVIEW_CANDIDATES" }));
  root.querySelector<HTMLElement>('[data-action="confirm-candidates"]')?.addEventListener("click", () => store.dispatch({ type: "CONFIRM_CANDIDATES" }));
  root.querySelector<HTMLFormElement>("[data-add-custom-candidate]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget as HTMLFormElement);
    store.dispatch({
      type: "ADD_CUSTOM_CANDIDATE",
      input: {
        name: String(values.get("name") ?? ""),
        quantity: String(values.get("quantity") ?? ""),
        category: String(values.get("category") ?? "household") as PackingCategory,
        transportRule: String(values.get("transportRule") ?? "none") as TransportRule,
      },
    });
  });
  root.querySelectorAll<HTMLInputElement>("[data-candidate-id]").forEach((input) => {
    input.addEventListener("change", () => store.dispatch({ type: "TOGGLE_CANDIDATE", itemId: input.dataset.candidateId ?? "" }));
  });
  root.querySelectorAll<HTMLButtonElement>("[data-group-id]").forEach((button) => {
    button.addEventListener("click", () => store.dispatch({
      type: "SET_GROUP_SELECTION",
      category: button.dataset.groupId as PackingCategory,
      selected: button.dataset.groupSelected !== "true",
    }));
  });
  root.querySelector<HTMLElement>('[data-action="close-wizard"]')?.addEventListener("click", () => {
    syncWizardStep(root, store);
    if (store.getState().activeDocument) store.dispatch({ type: "CANCEL_EDIT" });
    else store.dispatch({ type: "RESET_PROJECT" });
  });
  root.querySelector<HTMLElement>('[data-action="home"]')?.addEventListener("click", (event) => event.preventDefault());
  root.querySelector<HTMLElement>('[data-action="new-trip"]')?.addEventListener("click", () => {
    if (window.confirm("新建旅行会重置当前本地项目。请先确认已导出需要保留的数据。")) {
      store.dispatch({ type: "RESET_PROJECT" });
    }
  });

  const bagSetup = root.querySelector<HTMLTextAreaElement>("#bagSetup");
  const preview = root.querySelector<HTMLElement>("#bagPreview");
  bagSetup?.addEventListener("input", () => {
    if (preview) preview.innerHTML = renderBagPreview(bagSetup.value);
  });
  if (store.getState().screen === "organize") bindOrganizationEvents(root, store);
  if (store.getState().screen === "workspace") bindWorkspaceEvents(root, store);
  bindBetaEvents(root, store);
}

const FOCUS_ATTRIBUTES = [
  "data-candidate-id",
  "data-pack-id",
  "data-departure-check",
  "data-workspace-view",
  "data-template",
  "data-group-id",
  "data-collapse-id",
  "data-search-result",
] as const;

function focusSelector(element: Element | null): string | null {
  if (!(element instanceof HTMLElement)) return null;
  if (element.id) return `#${CSS.escape(element.id)}`;
  for (const attribute of FOCUS_ATTRIBUTES) {
    const value = element.getAttribute(attribute);
    if (value !== null) return `[${attribute}="${CSS.escape(value)}"]`;
  }
  return null;
}

export function mountApp(root: HTMLElement, store: AppStore): () => void {
  let previousScreen: AppState["screen"] | null = null;
  let previousWizardStep: number | null = null;
  const update = (state: AppState) => {
    const active = root.ownerDocument.activeElement;
    const preservedSelector = focusSelector(active);
    const preserveSearchFocus = active instanceof HTMLInputElement && active.id === "workspaceSearch";
    const searchSelection = preserveSearchFocus ? active.selectionStart : null;
    const routeChanged = previousScreen !== null && (previousScreen !== state.screen || previousWizardStep !== state.wizardStep);
    renderApp(root, state);
    bindEvents(root, store);
    const preserved = preservedSelector ? root.querySelector<HTMLElement>(preservedSelector) : null;
    if (preserved && !routeChanged) {
      preserved.focus();
      if (preserveSearchFocus && preserved instanceof HTMLInputElement && searchSelection !== null) {
        preserved.setSelectionRange(searchSelection, searchSelection);
      }
    } else if (routeChanged) {
      const heading = root.querySelector<HTMLElement>("#main-content h1");
      heading?.setAttribute("tabindex", "-1");
      heading?.focus();
    }
    previousScreen = state.screen;
    previousWizardStep = state.wizardStep;
  };
  update(store.getState());
  return store.subscribe(update);
}
