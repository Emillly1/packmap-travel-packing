# MVP Specification

## Core journey

1. Choose a template or start blank.
2. Enter trip, transport, habits, and luggage structure.
3. Review a rule-generated candidate checklist.
4. Create the packing map.
5. Add, remove, edit, search, move, and mark items packed.
6. Run departure and transport audits.
7. Export JSON/TXT or print.

## Required capabilities

### Onboarding

- City, study, business, and family templates.
- Blank start.
- Four explicit setup steps with progress and back navigation.
- Autosave draft after every meaningful change.

### Planning engine

- Laundry-cycle quantities.
- Per-person versus shared-item scaling.
- Climate, activity, formal-event, first-night, and airport modules.
- Explicit negation handling such as "no hiking".
- Bring, buy locally, optional, and skip recommendations.

### Packing workspace

- Luggage, compartment, pouch, and item hierarchy.
- Carry-on, checked, and undecided container roles.
- Search with full location path.
- Pointer and touch movement controls.
- Packed/unpacked state and aggregate progress.
- Collapsible pouches and first-level luggage directory.

### Safety and departure

- Power bank and spare battery audit.
- Blade and large-liquid placement warnings.
- Valuables, essential medicine, eyewear, first-night kit, and document checks.
- Transport-aware departure checklist.
- Warnings must identify the item, issue, and suggested action.

### Data portability

- Versioned PackMap JSON as source of truth.
- Import of legacy schema `1.0`.
- Human-readable TXT export/import where possible.
- Print-friendly checklist.
- Backup before destructive replacement or migration.

## MVP acceptance gate

- Core flow passes desktop and mobile browser tests.
- Rule engine and schema migration tests pass.
- Refresh preserves draft and active trip.
- Malformed imports fail safely without overwriting current data.
- Keyboard users can finish setup and packing-status workflows.
- Reduced-motion preferences are honored.
