import type { AppState } from "./store";

const STORAGE_KEY = "packmap.app-state.v2";
const BACKUP_KEY = "packmap.app-state.v2.backup";
const IMPORT_BACKUP_KEY = "packmap.app-state.v2.import-backup";
const IMPORT_SOURCE_KEY = "packmap.app-state.v2.import-source";

export function loadState(): AppState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    return value as AppState;
  } catch {
    return null;
  }
}

export function saveState(state: AppState): void {
  try {
    const previous = window.localStorage.getItem(STORAGE_KEY);
    if (previous) window.localStorage.setItem(BACKUP_KEY, previous);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The active in-memory session remains usable when browser storage is unavailable.
  }
}

export function clearState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Clearing storage is best-effort; the store still resets in memory.
  }
}

export function saveImportBackup(state: AppState, sourceText: string): void {
  try {
    window.localStorage.setItem(IMPORT_BACKUP_KEY, JSON.stringify(state));
    window.localStorage.setItem(IMPORT_SOURCE_KEY, sourceText);
  } catch {
    // Import can proceed in memory even if a browser storage quota prevents backup.
  }
}

export function loadImportBackup(): AppState | null {
  try {
    const raw = window.localStorage.getItem(IMPORT_BACKUP_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" ? value as AppState : null;
  } catch {
    return null;
  }
}

export function hasImportBackup(): boolean {
  try {
    return Boolean(window.localStorage.getItem(IMPORT_BACKUP_KEY));
  } catch {
    return false;
  }
}
