# Release Checklist

## Scope

- [x] Release notes identify user-visible changes and schema changes.
- [x] Deferred features are not presented as available.
- [x] Product, privacy, safety, and support copy match actual behavior.

## Data safety

- [x] Current and previous schema fixtures import successfully.
- [x] Export then import preserves trip, hierarchy, quantities, states, warnings, and checks.
- [x] Invalid input cannot overwrite the active document.
- [x] Migration creates a restorable backup.

## Quality

- [ ] Typecheck, unit tests, browser tests, and production build pass in CI.
- [x] Template, setup, packing, search, export, and restore flows pass on desktop and mobile.
- [x] Keyboard focus, status announcements, focus visibility, and reduced motion are checked.
- [x] Print output is generated for A4 and US Letter.
- [x] No uncaught application exception or known high-severity data-loss defect remains open.

## Safety

- [x] Carry-on and checked warnings are phrased as guidance where rules vary.
- [x] Power banks, blades, liquids, valuables, medicine, and essential eyewear are audited.
- [x] Medical, immigration, and airline limitations are visible where relevant.

## Operations

- [ ] Production environment and rollback artifact are identified.
- [x] Privacy-safe local Beta feedback summaries are working; an external destination is still required for public release.
- [x] No analytics are enabled, and the in-app disclosure states this explicitly.
- [ ] Domain, HTTPS, cache headers, and asset loading are verified.

## Release decision

Ship only when the core journey is usable without AI, account, or external service availability.
