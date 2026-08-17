# Legacy Migration Plan

## Source

The existing PackMap organizer is a static single-file application with proven features and a `1.0` skill handoff format.

## Preserve

- Existing organizer data and stable item IDs.
- JSON/TXT exports and the four published scenario fixtures.
- Template concepts, safety knowledge, search paths, print behavior, and current visual artwork.
- The public skill as an independent planner and import producer.

## Replace

- Inline CSS and JavaScript.
- UI code that mutates global data and localStorage directly.
- Hard-coded recommendation rendering.
- Unversioned browser state and destructive replacement without migration boundaries.

## Sequence

1. Freeze the legacy repository as the behavioral reference.
2. Recreate the trip setup vertical slice using formal types.
3. Add `1.0` fixtures to migration tests.
4. Port the recommendation engine as pure functions.
5. Port the packing workspace feature by feature.
6. Run both applications against the same fixtures until outputs match.
7. Replace the public entry point only after parity and export recovery are verified.

The legacy application remains usable throughout migration.
