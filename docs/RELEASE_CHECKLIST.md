# Release Checklist

## Scope

- [ ] Release notes identify user-visible changes and schema changes.
- [ ] Deferred features are not presented as available.
- [ ] Product, privacy, safety, and support copy match actual behavior.

## Data safety

- [ ] Current and previous schema fixtures import successfully.
- [ ] Export then import preserves trip, hierarchy, quantities, states, warnings, and checks.
- [ ] Invalid input cannot overwrite the active document.
- [ ] Migration creates a restorable backup.

## Quality

- [ ] Typecheck, unit tests, browser tests, and production build pass in CI.
- [ ] Template, setup, packing, search, export, and restore flows pass on desktop and mobile.
- [ ] Keyboard focus, status announcements, contrast, and reduced motion are checked.
- [ ] Print output is readable on A4 and US Letter.
- [ ] No high-severity console error or data-loss defect remains open.

## Safety

- [ ] Carry-on and checked warnings are phrased as guidance where rules vary.
- [ ] Power banks, blades, liquids, valuables, medicine, and essential eyewear are audited.
- [ ] Medical, immigration, and airline limitations are visible where relevant.

## Operations

- [ ] Production environment and rollback artifact are identified.
- [ ] Error reporting and feedback channels are working.
- [ ] Analytics, if enabled, disclose collection and avoid sensitive packing details.
- [ ] Domain, HTTPS, cache headers, and asset loading are verified.

## Release decision

Ship only when the core journey is usable without AI, account, or external service availability.
