# PackMap

PackMap turns trip details into an actionable packing map: what to bring, what to buy locally, and where every item belongs.

This repository is the maintainable product rewrite of the original single-file organizer. The first milestone preserves the proven workflow while separating product rules, state, storage, and UI.

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
```

See [docs/ROADMAP.md](docs/ROADMAP.md) for the delivery sequence.
