# User Flows

## New traveler

```text
Open app
→ choose template or blank
→ complete four setup steps
→ review candidate checklist
→ create packing map
→ adjust locations
→ pack and check off items
→ complete departure checks
→ export or print
```

The user may leave at any step. A local draft must restore them to the same step.

## Returning traveler

```text
Open app
→ resume active trip
→ search or continue packing
→ review remaining items and warnings
```

## Importing a skill result

```text
Import JSON
→ validate schema and IDs
→ show trip/container/item summary
→ back up current map
→ migrate if needed
→ open imported workspace
```

## Editing the hierarchy

```text
Choose item or pouch
→ move control or drag gesture
→ choose valid destination
→ update location path
→ autosave
→ announce success
```

Invalid descendants and item-only destinations are never offered.

## Safety exception

```text
Rule detects mismatch
→ show non-blocking warning near item and in audit panel
→ offer move or acknowledge action
→ keep warning visible until resolved or explicitly acknowledged
```

## Failure recovery

- Storage failure: keep current in-memory work and offer JSON download.
- Invalid import: preserve current data and display the exact validation issue.
- New schema: refuse destructive downgrade and retain the original file.
- Interrupted setup: restore draft and active step.
