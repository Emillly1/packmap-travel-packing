# Delivery Roadmap

Current status: Phase 4 complete. Phase 5 is next.

## Phase 0: Product foundation

- Product brief, MVP specification, user flows, data schema, technical decisions.
- Legacy asset and data migration inventory.
- Exit: scope and data contracts are reviewable before feature migration.

## Phase 1: Maintainable application shell

- Vite, TypeScript, design tokens, store, persistence, templates.
- Template selection and four-step trip setup as the first vertical slice.
- Exit: a trip draft survives refresh and produces a valid `2.0.0` document.

## Phase 2: Planning engine

- Candidate catalog, quantities, shared-item rules, stage modules, negation handling.
- Checklist review and recommendation reasons.
- Exit: scenario fixtures produce deterministic suggestions.

## Phase 3: Packing workspace

- Tree rendering, CRUD, movement, search, packed state, progress, undo.
- Desktop, tablet, mobile, and touch interactions.
- Exit: users can build and maintain a complete map without editing JSON.

## Phase 4: Safety, departure, and portability

- Transport audits, first-night checks, JSON/TXT import-export, print, backups.
- Legacy `1.0` migration.
- Exit: all original organizer capabilities are available in the new architecture.

Completed with deterministic safety rules, transport-aware departure checks, strict `2.0.0` validation, lossless round trips, guarded imports, dedicated recovery, and paginated print output.

## Phase 5: Beta and release

- Five representative trip scenarios, browser tests, accessibility pass, performance budget.
- Privacy notice, terms, support and feedback path, release notes.
- Exit: no critical flow failures and no unresolved high-severity data-loss issues.

## Post-MVP

- Multiple trips, accounts, cloud sync, sharing, PWA installation.
- AI and payment remain separate initiatives after retention is demonstrated.
