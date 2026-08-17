import type { DepartureCheck, LuggageNode, PackingWarning } from "./packing";
import type { Trip } from "./trip";

export const CURRENT_SCHEMA_VERSION = "2.0.0" as const;

export interface PackMapDocument {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  id: string;
  createdAt: string;
  updatedAt: string;
  trip: Trip;
  containers: LuggageNode[];
  departureChecks: DepartureCheck[];
  warnings: PackingWarning[];
}
