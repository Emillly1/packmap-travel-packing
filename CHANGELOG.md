# Changelog

## 0.2.0-beta.1 - 2026-08-18

### Added

- Guided organization confirmation between candidate review and the final packing map.
- Automatic pouch suggestions with in-place item and pouch creation.
- Original organizer text import, including indentation, quantities, packed state, and `袋子面` to `拉链面` migration.
- Transport safety audit, departure checklist, JSON/TXT portability, import recovery, and A4/US Letter print output.
- Local privacy and usage disclosure, complete local-data deletion, and privacy-safe Beta feedback summaries.
- GitHub Pages deployment, public Beta issue form, and a documented rollback path.
- Five-scenario Beta acceptance matrix, browser accessibility checks, and performance budgets.

### Changed

- Single-compartment luggage now uses the full available width.
- Narrow pouch controls wrap without overflowing their container.
- Keyboard focus survives checklist updates and moves to the new heading after route changes.

### Data

- The source-of-truth schema remains `2.0.0`; this release does not require a schema migration.
