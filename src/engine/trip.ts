import { CURRENT_SCHEMA_VERSION, type PackMapDocument } from "../models/schema";
import type { Trip, TripDraft } from "../models/trip";

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

function hasValidDateRange(draft: TripDraft): boolean {
  if (!draft.startDate || !draft.endDate) return false;
  return new Date(`${draft.endDate}T00:00:00`).getTime() >= new Date(`${draft.startDate}T00:00:00`).getTime();
}

export function validateWizardStep(step: number, draft: TripDraft): ValidationResult {
  if (step === 0) {
    if (!draft.name.trim() || !draft.origin.trim() || !draft.destinationsText.trim()) {
      return { valid: false, message: "请填写旅行名称、出发地和目的地。" };
    }
    if (!hasValidDateRange(draft)) {
      return { valid: false, message: "请填写有效的出发和返回日期。" };
    }
    if (!Number.isInteger(draft.travelers) || draft.travelers < 1 || draft.travelers > 20) {
      return { valid: false, message: "旅行人数需要在 1 到 20 人之间。" };
    }
  }

  if (step === 1 && draft.transportModes.length === 0) {
    return { valid: false, message: "请至少选择一种出行方式。" };
  }

  if (step === 3 && !draft.bagSetup.trim()) {
    return { valid: false, message: "请至少建立一个箱包一级目录。" };
  }

  return { valid: true };
}

export function parseDestinations(value: string): string[] {
  return value
    .split(/[、,，;；\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function tripDurationDays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00`).getTime();
  const end = new Date(`${endDate}T00:00:00`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.floor((end - start) / 86_400_000) + 1;
}

function tripFromDraft(draft: TripDraft): Trip {
  return {
    name: draft.name.trim(),
    origin: draft.origin.trim(),
    destinations: parseDestinations(draft.destinationsText),
    startDate: draft.startDate,
    endDate: draft.endDate,
    travelers: draft.travelers,
    tripType: draft.tripType,
    laundryFrequency: draft.laundryFrequency,
    transportModes: [...draft.transportModes],
    transportNotes: draft.transportNotes.trim(),
    specialNeeds: draft.specialNeeds.trim(),
    bagSetup: draft.bagSetup.trim(),
    stages: [],
  };
}

export function createPackMapDocument(draft: TripDraft, now = new Date()): PackMapDocument {
  const timestamp = now.toISOString();

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: `trip-${now.getTime().toString(36)}`,
    createdAt: timestamp,
    updatedAt: timestamp,
    trip: tripFromDraft(draft),
    containers: [],
    departureChecks: [],
    warnings: [],
  };
}

export function updatePackMapDocument(document: PackMapDocument, draft: TripDraft, now = new Date()): PackMapDocument {
  return {
    ...document,
    updatedAt: now.toISOString(),
    trip: tripFromDraft(draft),
  };
}
