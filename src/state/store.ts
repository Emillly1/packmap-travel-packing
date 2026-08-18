import { getTripTemplate } from "../data/templates";
import {
  addMapNode,
  deleteMapNode,
  findMapEntry,
  moveMapNode,
  organizeLooseItemsIntoPouches,
  rebalanceLooseItems,
  setAllItemsPacked,
  syncPackingMap,
  togglePackedItem,
  unpackBag,
  updateMapNode,
  type MapNodePatch,
  type NewMapNode,
} from "../engine/packingMap";
import { addCustomCandidate, generatePackingSuggestions, reconcilePlanningSelections, type CustomCandidateInput } from "../engine/planning";
import { acknowledgeWarning, refreshSafetyData, toggleDepartureCheck } from "../engine/safety";
import { createPackMapDocument, updatePackMapDocument } from "../engine/trip";
import type { PackingCategory, PlanningResult } from "../models/planning";
import type { PackMapDocument } from "../models/schema";
import { EMPTY_TRIP_DRAFT, type TemplateId, type TripDraft } from "../models/trip";
import { clearState, hasImportBackup, loadImportBackup, loadState, saveImportBackup, saveState } from "./storage";

export type AppScreen = "templates" | "wizard" | "review" | "organize" | "workspace";
export type WorkspaceMode = "inspect" | "add-item" | "add-bag" | "add-compartment" | "add-luggage";
export type WorkspaceView = "map" | "safety" | "departure" | "data";

export interface AppState {
  screen: AppScreen;
  selectedTemplate: TemplateId | null;
  wizardStep: number;
  draft: TripDraft;
  activeDocument: PackMapDocument | null;
  planningResult: PlanningResult | null;
  planningConfirmed: boolean;
  workspaceSearch: string;
  selectedMapNodeId: string | null;
  workspaceMode: WorkspaceMode;
  workspaceView: WorkspaceView;
  collapsedNodeIds: string[];
  documentHistory: PackMapDocument[];
  importBackupAvailable: boolean;
  notice: string | null;
  error: string | null;
}

export type AppAction =
  | { type: "START_TEMPLATE"; templateId: TemplateId }
  | { type: "UPDATE_DRAFT"; patch: Partial<TripDraft> }
  | { type: "SET_WIZARD_STEP"; step: number }
  | { type: "SET_ERROR"; message: string | null }
  | { type: "COMPLETE_SETUP" }
  | { type: "TOGGLE_CANDIDATE"; itemId: string }
  | { type: "SET_GROUP_SELECTION"; category: PackingCategory; selected: boolean }
  | { type: "ADD_CUSTOM_CANDIDATE"; input: CustomCandidateInput }
  | { type: "CONFIRM_CANDIDATES" }
  | { type: "BACK_TO_REVIEW" }
  | { type: "CONFIRM_ORGANIZATION" }
  | { type: "REVIEW_CANDIDATES" }
  | { type: "SET_WORKSPACE_SEARCH"; query: string }
  | { type: "SELECT_MAP_NODE"; nodeId: string | null }
  | { type: "SET_WORKSPACE_MODE"; mode: WorkspaceMode }
  | { type: "SET_WORKSPACE_VIEW"; view: WorkspaceView }
  | { type: "TOGGLE_COLLAPSED_NODE"; nodeId: string }
  | { type: "TOGGLE_PACKED_ITEM"; itemId: string }
  | { type: "SET_ALL_PACKED"; packed: boolean }
  | { type: "MOVE_MAP_NODE"; nodeId: string; targetId: string }
  | { type: "REBALANCE_MAP" }
  | { type: "CREATE_POUCH_PLAN" }
  | { type: "ADD_MAP_NODE"; input: NewMapNode }
  | { type: "UPDATE_MAP_NODE"; nodeId: string; patch: MapNodePatch }
  | { type: "DELETE_MAP_NODE"; nodeId: string }
  | { type: "UNPACK_BAG"; bagId: string }
  | { type: "UNDO_MAP_CHANGE" }
  | { type: "ACKNOWLEDGE_WARNING"; warningId: string }
  | { type: "TOGGLE_DEPARTURE_CHECK"; checkId: string }
  | { type: "IMPORT_DOCUMENT"; document: PackMapDocument; sourceText: string; migrated: boolean }
  | { type: "RESTORE_IMPORT_BACKUP" }
  | { type: "EDIT_TRIP" }
  | { type: "CANCEL_EDIT" }
  | { type: "RESET_PROJECT" };

export interface AppStore {
  getState(): AppState;
  dispatch(action: AppAction): void;
  subscribe(listener: (state: AppState) => void): () => void;
}

const initialState: AppState = {
  screen: "templates",
  selectedTemplate: null,
  wizardStep: 0,
  draft: { ...EMPTY_TRIP_DRAFT },
  activeDocument: null,
  planningResult: null,
  planningConfirmed: false,
  workspaceSearch: "",
  selectedMapNodeId: null,
  workspaceMode: "inspect",
  workspaceView: "map",
  collapsedNodeIds: [],
  documentHistory: [],
  importBackupAvailable: false,
  notice: null,
  error: null,
};

function applyDocumentMutation(
  state: AppState,
  mutate: (document: PackMapDocument) => PackMapDocument,
  notice: string,
): AppState {
  if (!state.activeDocument) return state;
  const mutatedDocument = mutate(state.activeDocument);
  const nextDocument = mutatedDocument === state.activeDocument ? mutatedDocument : refreshSafetyData(mutatedDocument);
  if (nextDocument === state.activeDocument) return { ...state, notice: "这项操作不能在当前位置完成。" };
  return {
    ...state,
    activeDocument: nextDocument,
    documentHistory: [...state.documentHistory.slice(-9), state.activeDocument],
    notice,
    error: null,
  };
}

function updatePlanningItems(
  result: PlanningResult | null,
  predicate: (category: PackingCategory, itemId: string) => boolean,
  selected: boolean | null,
): PlanningResult | null {
  if (!result) return null;
  return {
    ...result,
    groups: result.groups.map((group) => ({
      ...group,
      items: group.items.map((item) => predicate(group.id, item.id)
        ? { ...item, selected: selected ?? !item.selected }
        : item),
    })),
  };
}

export function reduceAppState(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "START_TEMPLATE": {
      const template = getTripTemplate(action.templateId);
      return {
        ...state,
        screen: "wizard",
        selectedTemplate: action.templateId,
        wizardStep: 0,
        draft: { ...template.defaults, transportModes: [...template.defaults.transportModes] },
        activeDocument: null,
        planningResult: null,
        planningConfirmed: false,
        workspaceSearch: "",
        selectedMapNodeId: null,
        workspaceMode: "inspect",
        workspaceView: "map",
        collapsedNodeIds: [],
        documentHistory: [],
        importBackupAvailable: state.importBackupAvailable,
        notice: null,
        error: null,
      };
    }
    case "UPDATE_DRAFT":
      return { ...state, draft: { ...state.draft, ...action.patch }, error: null };
    case "SET_WIZARD_STEP":
      return { ...state, wizardStep: Math.min(3, Math.max(0, action.step)), error: null };
    case "SET_ERROR":
      return { ...state, error: action.message };
    case "COMPLETE_SETUP": {
      const planningResult = reconcilePlanningSelections(
        generatePackingSuggestions(state.draft),
        state.planningResult,
      );
      return {
        ...state,
        screen: "review",
        activeDocument: state.activeDocument
          ? updatePackMapDocument(state.activeDocument, state.draft)
          : createPackMapDocument(state.draft),
        planningResult,
        planningConfirmed: false,
        error: null,
      };
    }
    case "TOGGLE_CANDIDATE":
      return {
        ...state,
        planningResult: updatePlanningItems(state.planningResult, (_category, itemId) => itemId === action.itemId, null),
        planningConfirmed: false,
      };
    case "SET_GROUP_SELECTION":
      return {
        ...state,
        planningResult: updatePlanningItems(state.planningResult, (category) => category === action.category, action.selected),
        planningConfirmed: false,
      };
    case "ADD_CUSTOM_CANDIDATE":
      return state.planningResult
        ? {
            ...state,
            planningResult: addCustomCandidate(state.planningResult, action.input),
            planningConfirmed: false,
            notice: "自定义物品已加入候选清单。",
            error: null,
          }
        : state;
    case "CONFIRM_CANDIDATES":
      return {
        ...state,
        screen: "organize",
        activeDocument: state.activeDocument && state.planningResult
          ? refreshSafetyData(syncPackingMap(state.activeDocument, state.draft, state.planningResult))
          : state.activeDocument,
        planningConfirmed: false,
        workspaceMode: "inspect",
        workspaceView: "map",
        selectedMapNodeId: null,
        documentHistory: [],
        notice: "候选清单已生成收纳方案。",
        error: null,
      };
    case "BACK_TO_REVIEW":
      return { ...state, screen: "review", error: null };
    case "CONFIRM_ORGANIZATION":
      return {
        ...state,
        screen: "workspace",
        activeDocument: state.activeDocument ? refreshSafetyData(state.activeDocument) : null,
        planningConfirmed: true,
        workspaceMode: "inspect",
        workspaceView: "map",
        selectedMapNodeId: null,
        documentHistory: [],
        notice: "收纳方案已确认，可以开始打包。",
        error: null,
      };
    case "REVIEW_CANDIDATES":
      return state.planningResult ? { ...state, screen: "review", error: null } : state;
    case "SET_WORKSPACE_SEARCH":
      return { ...state, workspaceSearch: action.query, notice: null };
    case "SELECT_MAP_NODE":
      return { ...state, selectedMapNodeId: action.nodeId, workspaceMode: "inspect", notice: null };
    case "SET_WORKSPACE_MODE":
      return { ...state, workspaceMode: action.mode, selectedMapNodeId: action.mode === "inspect" ? state.selectedMapNodeId : null, notice: null };
    case "SET_WORKSPACE_VIEW":
      return { ...state, workspaceView: action.view, selectedMapNodeId: null, workspaceMode: "inspect", notice: null, error: null };
    case "TOGGLE_COLLAPSED_NODE":
      return {
        ...state,
        collapsedNodeIds: state.collapsedNodeIds.includes(action.nodeId)
          ? state.collapsedNodeIds.filter((id) => id !== action.nodeId)
          : [...state.collapsedNodeIds, action.nodeId],
      };
    case "TOGGLE_PACKED_ITEM":
      return applyDocumentMutation(state, (document) => togglePackedItem(document, action.itemId), "已更新装入状态。");
    case "SET_ALL_PACKED":
      return applyDocumentMutation(state, (document) => setAllItemsPacked(document, action.packed), action.packed ? "全部物品已标记装入。" : "全部物品已标记未装。");
    case "MOVE_MAP_NODE":
      return applyDocumentMutation(state, (document) => moveMapNode(document, action.nodeId, action.targetId), "物品位置已更新。");
    case "REBALANCE_MAP":
      return applyDocumentMutation(state, rebalanceLooseItems, "未归袋物品已按箱包角色均匀分配，可撤销。");
    case "CREATE_POUCH_PLAN":
      return applyDocumentMutation(state, organizeLooseItemsIntoPouches, "散放物品已整理成建议收纳袋，可撤销。");
    case "ADD_MAP_NODE": {
      const next = applyDocumentMutation(state, (document) => addMapNode(document, action.input), "新内容已加入地图。");
      return { ...next, workspaceMode: "inspect" };
    }
    case "UPDATE_MAP_NODE":
      return applyDocumentMutation(state, (document) => updateMapNode(document, action.nodeId, action.patch), "修改已保存。");
    case "DELETE_MAP_NODE": {
      const next = applyDocumentMutation(state, (document) => deleteMapNode(document, action.nodeId), "内容已从地图移除。");
      return { ...next, selectedMapNodeId: null, workspaceMode: "inspect" };
    }
    case "UNPACK_BAG":
      return applyDocumentMutation(state, (document) => unpackBag(document, action.bagId), "收纳袋已移除，袋内物品保留在原区域，可撤销。");
    case "UNDO_MAP_CHANGE": {
      const previous = state.documentHistory.at(-1);
      if (!previous) return { ...state, notice: "没有可以撤销的操作。" };
      return {
        ...state,
        activeDocument: previous,
        documentHistory: state.documentHistory.slice(0, -1),
        selectedMapNodeId: state.selectedMapNodeId && findMapEntry(previous, state.selectedMapNodeId) ? state.selectedMapNodeId : null,
        notice: "已撤销上一步操作。",
      };
    }
    case "ACKNOWLEDGE_WARNING":
      return applyDocumentMutation(state, (document) => acknowledgeWarning(document, action.warningId), "安全提醒状态已更新。");
    case "TOGGLE_DEPARTURE_CHECK":
      return applyDocumentMutation(state, (document) => toggleDepartureCheck(document, action.checkId), "出发检查状态已更新。");
    case "IMPORT_DOCUMENT": {
      const document = refreshSafetyData(action.document);
      return {
        ...state,
        screen: "workspace",
        selectedTemplate: null,
        wizardStep: 0,
        draft: {
          name: document.trip.name,
          origin: document.trip.origin,
          destinationsText: document.trip.destinations.join("、"),
          startDate: document.trip.startDate,
          endDate: document.trip.endDate,
          travelers: document.trip.travelers,
          tripType: document.trip.tripType,
          laundryFrequency: document.trip.laundryFrequency,
          transportModes: [...document.trip.transportModes],
          transportNotes: document.trip.transportNotes,
          specialNeeds: document.trip.specialNeeds,
          bagSetup: document.trip.bagSetup,
        },
        activeDocument: document,
        planningResult: null,
        planningConfirmed: true,
        workspaceSearch: "",
        selectedMapNodeId: null,
        workspaceMode: "inspect",
        workspaceView: "map",
        collapsedNodeIds: [],
        documentHistory: [],
        importBackupAvailable: true,
        notice: action.migrated ? "旧版 1.0 文件已迁移并导入。" : "PackMap 文件已导入。",
        error: null,
      };
    }
    case "RESTORE_IMPORT_BACKUP":
      return state;
    case "EDIT_TRIP":
      return { ...state, screen: "wizard", wizardStep: 0, error: null };
    case "CANCEL_EDIT":
      return {
        ...state,
        screen: state.planningResult ? (state.planningConfirmed ? "workspace" : "review") : "templates",
        error: null,
      };
    case "RESET_PROJECT":
      return { ...initialState, draft: { ...EMPTY_TRIP_DRAFT } };
  }
}

function isUsableState(value: AppState | null): value is AppState {
  return Boolean(value && ["templates", "wizard", "review", "organize", "workspace"].includes(value.screen) && value.draft);
}

function normalizeState(value: AppState): AppState {
  return {
    ...initialState,
    ...value,
    planningResult: value.planningResult ?? null,
    planningConfirmed: value.planningConfirmed ?? false,
    workspaceSearch: value.workspaceSearch ?? "",
    selectedMapNodeId: value.selectedMapNodeId ?? null,
    workspaceMode: value.workspaceMode ?? "inspect",
    workspaceView: value.workspaceView ?? "map",
    collapsedNodeIds: value.collapsedNodeIds ?? [],
    documentHistory: value.documentHistory ?? [],
    importBackupAvailable: hasImportBackup(),
    notice: value.notice ?? null,
  };
}

export function createAppStore(): AppStore {
  const persisted = loadState();
  let state = isUsableState(persisted)
    ? normalizeState(persisted)
    : { ...initialState, draft: { ...EMPTY_TRIP_DRAFT } };
  if (state.activeDocument && state.planningResult && state.planningConfirmed && state.activeDocument.containers.length === 0) {
    state = { ...state, activeDocument: syncPackingMap(state.activeDocument, state.draft, state.planningResult) };
  }
  if (state.activeDocument && state.planningConfirmed) state = { ...state, activeDocument: refreshSafetyData(state.activeDocument) };
  const listeners = new Set<(nextState: AppState) => void>();

  return {
    getState: () => state,
    dispatch(action) {
      if (action.type === "RESTORE_IMPORT_BACKUP") {
        const backup = loadImportBackup();
        state = isUsableState(backup)
          ? { ...normalizeState(backup), importBackupAvailable: true, notice: "已恢复导入前的旅行。", error: null }
          : { ...state, notice: null, error: "没有可恢复的导入前备份。" };
      } else {
        if (action.type === "IMPORT_DOCUMENT") saveImportBackup(state, action.sourceText);
        state = reduceAppState(state, action);
      }
      if (action.type === "RESET_PROJECT") clearState();
      else saveState(state);
      listeners.forEach((listener) => listener(state));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
