import { getTripTemplate } from "../data/templates";
import { createPackMapDocument, updatePackMapDocument } from "../engine/trip";
import type { PackMapDocument } from "../models/schema";
import { EMPTY_TRIP_DRAFT, type TemplateId, type TripDraft } from "../models/trip";
import { clearState, loadState, saveState } from "./storage";

export type AppScreen = "templates" | "wizard" | "workspace";

export interface AppState {
  screen: AppScreen;
  selectedTemplate: TemplateId | null;
  wizardStep: number;
  draft: TripDraft;
  activeDocument: PackMapDocument | null;
  error: string | null;
}

export type AppAction =
  | { type: "START_TEMPLATE"; templateId: TemplateId }
  | { type: "UPDATE_DRAFT"; patch: Partial<TripDraft> }
  | { type: "SET_WIZARD_STEP"; step: number }
  | { type: "SET_ERROR"; message: string | null }
  | { type: "COMPLETE_SETUP" }
  | { type: "EDIT_TRIP" }
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
  error: null,
};

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "START_TEMPLATE": {
      const template = getTripTemplate(action.templateId);
      return {
        ...state,
        screen: "wizard",
        selectedTemplate: action.templateId,
        wizardStep: 0,
        draft: { ...template.defaults, transportModes: [...template.defaults.transportModes] },
        error: null,
      };
    }
    case "UPDATE_DRAFT":
      return { ...state, draft: { ...state.draft, ...action.patch }, error: null };
    case "SET_WIZARD_STEP":
      return { ...state, wizardStep: Math.min(3, Math.max(0, action.step)), error: null };
    case "SET_ERROR":
      return { ...state, error: action.message };
    case "COMPLETE_SETUP":
      return {
        ...state,
        screen: "workspace",
        activeDocument: state.activeDocument
          ? updatePackMapDocument(state.activeDocument, state.draft)
          : createPackMapDocument(state.draft),
        error: null,
      };
    case "EDIT_TRIP":
      return { ...state, screen: "wizard", wizardStep: 0, error: null };
    case "RESET_PROJECT":
      return { ...initialState, draft: { ...EMPTY_TRIP_DRAFT } };
  }
}

function isUsableState(value: AppState | null): value is AppState {
  return Boolean(value && ["templates", "wizard", "workspace"].includes(value.screen) && value.draft);
}

export function createAppStore(): AppStore {
  const persisted = loadState();
  let state = isUsableState(persisted) ? persisted : { ...initialState, draft: { ...EMPTY_TRIP_DRAFT } };
  const listeners = new Set<(nextState: AppState) => void>();

  return {
    getState: () => state,
    dispatch(action) {
      state = reducer(state, action);
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
