import { getTripTemplate } from "../data/templates";
import { generatePackingSuggestions, reconcilePlanningSelections } from "../engine/planning";
import { createPackMapDocument, updatePackMapDocument } from "../engine/trip";
import type { PackingCategory, PlanningResult } from "../models/planning";
import type { PackMapDocument } from "../models/schema";
import { EMPTY_TRIP_DRAFT, type TemplateId, type TripDraft } from "../models/trip";
import { clearState, loadState, saveState } from "./storage";

export type AppScreen = "templates" | "wizard" | "review" | "workspace";

export interface AppState {
  screen: AppScreen;
  selectedTemplate: TemplateId | null;
  wizardStep: number;
  draft: TripDraft;
  activeDocument: PackMapDocument | null;
  planningResult: PlanningResult | null;
  planningConfirmed: boolean;
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
  error: null,
};

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
      return { ...state, screen: "workspace", planningConfirmed: true, error: null };
    case "REVIEW_CANDIDATES":
      return state.planningResult ? { ...state, screen: "review", error: null } : state;
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
      }
    : { ...initialState, draft: { ...EMPTY_TRIP_DRAFT } };
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
