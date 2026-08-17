import { getTripTemplate } from "../data/templates";
import {
  addMapNode,
  deleteMapNode,
  findMapEntry,
  moveMapNode,
  setAllItemsPacked,
  syncPackingMap,
  togglePackedItem,
  updateMapNode,
  type MapNodePatch,
  type NewMapNode,
} from "../engine/packingMap";
import { generatePackingSuggestions, reconcilePlanningSelections } from "../engine/planning";
import { createPackMapDocument, updatePackMapDocument } from "../engine/trip";
import type { PackingCategory, PlanningResult } from "../models/planning";
import type { PackMapDocument } from "../models/schema";
import { EMPTY_TRIP_DRAFT, type TemplateId, type TripDraft } from "../models/trip";
import { clearState, loadState, saveState } from "./storage";

export type AppScreen = "templates" | "wizard" | "review" | "workspace";
export type WorkspaceMode = "inspect" | "add-item" | "add-bag" | "add-compartment" | "add-luggage";

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
  collapsedNodeIds: string[];
  documentHistory: PackMapDocument[];
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
  | { type: "CONFIRM_CANDIDATES" }
  | { type: "REVIEW_CANDIDATES" }
  | { type: "SET_WORKSPACE_SEARCH"; query: string }
  | { type: "SELECT_MAP_NODE"; nodeId: string | null }
  | { type: "SET_WORKSPACE_MODE"; mode: WorkspaceMode }
  | { type: "TOGGLE_COLLAPSED_NODE"; nodeId: string }
  | { type: "TOGGLE_PACKED_ITEM"; itemId: string }
  | { type: "SET_ALL_PACKED"; packed: boolean }
  | { type: "MOVE_MAP_NODE"; nodeId: string; targetId: string }
  | { type: "ADD_MAP_NODE"; input: NewMapNode }
  | { type: "UPDATE_MAP_NODE"; nodeId: string; patch: MapNodePatch }
  | { type: "DELETE_MAP_NODE"; nodeId: string }
  | { type: "UNDO_MAP_CHANGE" }
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
  collapsedNodeIds: [],
  documentHistory: [],
  notice: null,
  error: null,
};

function applyDocumentMutation(
  state: AppState,
  mutate: (document: PackMapDocument) => PackMapDocument,
  notice: string,
): AppState {
  if (!state.activeDocument) return state;
  const nextDocument = mutate(state.activeDocument);
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
        collapsedNodeIds: [],
        documentHistory: [],
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
    case "CONFIRM_CANDIDATES":
      return {
        ...state,
        screen: "workspace",
        activeDocument: state.activeDocument && state.planningResult
          ? syncPackingMap(state.activeDocument, state.draft, state.planningResult)
          : state.activeDocument,
        planningConfirmed: true,
        workspaceMode: "inspect",
        selectedMapNodeId: null,
        documentHistory: [],
        notice: "候选清单已建立为收纳地图。",
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
  return Boolean(value && ["templates", "wizard", "review", "workspace"].includes(value.screen) && value.draft);
}

export function createAppStore(): AppStore {
  const persisted = loadState();
  let state = isUsableState(persisted)
    ? {
        ...initialState,
        ...persisted,
        planningResult: persisted.planningResult ?? null,
        planningConfirmed: persisted.planningConfirmed ?? false,
        workspaceSearch: persisted.workspaceSearch ?? "",
        selectedMapNodeId: persisted.selectedMapNodeId ?? null,
        workspaceMode: persisted.workspaceMode ?? "inspect",
        collapsedNodeIds: persisted.collapsedNodeIds ?? [],
        documentHistory: persisted.documentHistory ?? [],
        notice: persisted.notice ?? null,
      }
    : { ...initialState, draft: { ...EMPTY_TRIP_DRAFT } };
  if (state.activeDocument && state.planningResult && state.planningConfirmed && state.activeDocument.containers.length === 0) {
    state = { ...state, activeDocument: syncPackingMap(state.activeDocument, state.draft, state.planningResult) };
  }
  const listeners = new Set<(nextState: AppState) => void>();

  return {
    getState: () => state,
    dispatch(action) {
      state = reduceAppState(state, action);
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
