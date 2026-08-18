# PackMap

PackMap turns trip details into an actionable packing map: what to bring, what to buy locally, and where every item belongs.

This repository is the maintainable product rewrite of the original single-file organizer. The current product slice includes trip templates, guided setup, deterministic packing recommendations, candidate review, a dedicated organization-confirmation step, an interactive luggage map, transport safety review, departure checks, and local-first data portability.

The packing workflow automatically proposes nested pouches before the final map. Users can add items or pouches directly inside any luggage level, rename or move pouches, tap an item to choose its destination, remove a pouch without deleting its contents, and keep deliberately loose items loose. The final workspace supports full-path search, packed status, drag-and-drop movement, touch-friendly destination controls, map editing, and ten-step undo.

The primary flow is: choose a template -> describe the trip -> review candidate items -> confirm the organization plan -> pack from the location map -> run safety and departure checks -> export or print.

The release workspace also provides transport-aware warnings, a reusable departure checklist, lossless JSON and readable TXT exports, validated imports, legacy `1.0` migration, indented-text migration from the original organizer, a dedicated pre-import recovery point, and a print-ready packing report.

Original organizer exports such as `欧洲行李位置地图` can be pasted directly into Data & Print. PackMap reconstructs luggage, compartments, nested pouches, item quantities, and packed status, while normalizing the old `袋子面` label to `拉链面`.

## Product principles

- Start with the real planning workflow, not a marketing landing page.
- Keep rule-based planning useful without AI.
- Treat the luggage map as the source of truth, not a flat checklist.
- Preserve user data across releases through versioned schemas and migrations.
- Keep medical, immigration, airline, and restricted-item guidance clearly scoped.

## Development

```bash
npm install
npm run dev
```

Other checks:

```bash
npm run typecheck
npm test
npm run build
```

With the Vite server and a Chrome remote-debugging session running, the repeatable browser smoke test is:

```bash
npm run test:browser
```

## Repository layout

```text
docs/                 Product, UX, data, technical, and release decisions
.github/workflows/     Continuous verification for every change
public/               Static artwork and public assets
src/data/             Templates and catalog data
src/engine/           Pure planning and validation rules
src/models/           Versioned domain types
src/state/            Store, persistence, and migrations
src/ui/               Screen-level UI modules
src/styles/           Design tokens, foundations, components, responsive rules
tests/                Unit and contract tests
scripts/              Repeatable end-to-end browser checks
```

See [docs/ROADMAP.md](docs/ROADMAP.md) for the delivery sequence.
