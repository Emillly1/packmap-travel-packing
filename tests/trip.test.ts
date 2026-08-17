import { describe, expect, it } from "vitest";

import { createPackMapDocument, parseDestinations, tripDurationDays, updatePackMapDocument, validateWizardStep } from "../src/engine/trip";
import { getTripTemplate } from "../src/data/templates";

describe("trip setup", () => {
  it("parses common destination separators", () => {
    expect(parseDestinations("巴黎、里昂, 米兰；爱丁堡")).toEqual(["巴黎", "里昂", "米兰", "爱丁堡"]);
  });

  it("counts both travel dates", () => {
    expect(tripDurationDays("2026-07-01", "2026-07-31")).toBe(31);
  });

  it("requires transport before leaving step two", () => {
    const draft = { ...getTripTemplate("blank").defaults, transportModes: [] };
    expect(validateWizardStep(1, draft)).toEqual({ valid: false, message: "请至少选择一种出行方式。" });
  });

  it("creates a versioned document without mutating template arrays", () => {
    const draft = {
      ...getTripTemplate("city").defaults,
      origin: "上海",
      destinationsText: "罗马、佛罗伦萨",
      startDate: "2026-09-10",
      endDate: "2026-09-20",
    };
    const document = createPackMapDocument(draft, new Date("2026-08-18T00:00:00.000Z"));
    document.trip.transportModes.push("ferry");

    expect(document.schemaVersion).toBe("2.0.0");
    expect(document.trip.destinations).toEqual(["罗马", "佛罗伦萨"]);
    expect(getTripTemplate("city").defaults.transportModes).toEqual(["plane", "train"]);
  });

  it("keeps the document identity when editing a trip", () => {
    const draft = {
      ...getTripTemplate("city").defaults,
      origin: "上海",
      destinationsText: "罗马",
      startDate: "2026-09-10",
      endDate: "2026-09-20",
    };
    const document = createPackMapDocument(draft, new Date("2026-08-18T00:00:00.000Z"));
    const updated = updatePackMapDocument(document, { ...draft, name: "秋日罗马" }, new Date("2026-08-19T00:00:00.000Z"));

    expect(updated.id).toBe(document.id);
    expect(updated.createdAt).toBe(document.createdAt);
    expect(updated.updatedAt).toBe("2026-08-19T00:00:00.000Z");
    expect(updated.trip.name).toBe("秋日罗马");
  });
});
