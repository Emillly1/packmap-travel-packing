# PackMap Data Schema

## Version policy

The application uses semantic schema versions. `2.0.0` is the first formal application schema. Legacy skill and organizer documents using `schema_version: "1.0"` remain importable.

Breaking changes require a migration and fixture. Exported JSON always includes `schemaVersion`.

## Document shape

```ts
interface PackMapDocument {
  schemaVersion: "2.0.0";
  id: string;
  createdAt: string;
  updatedAt: string;
  trip: Trip;
  containers: LuggageNode[];
  departureChecks: DepartureCheck[];
  warnings: Warning[];
  metadata?: Record<string, unknown>;
}
```

## Hierarchy

```text
luggage
└── compartment
    ├── bag
    │   ├── bag
    │   └── item
    └── item
```

Top-level nodes must be luggage. Items cannot have children. IDs are unique within the document and remain stable through moves and renames.

## Item fields

- `name`, `quantity`, `category`, `packed`
- `transportRule`: carry-on, checked, or none
- `access`: airport, daily, first-night, later, or any
- `recommendation`: bring, buy-local, optional, or skip
- `stageIds`, `risk`, `reason`, and optional user notes

## Migration requirements

- Convert legacy snake_case keys to camelCase.
- Preserve unknown non-conflicting fields in `metadata` where practical.
- Normalize `carry_on` to `carry-on` internally.
- Back up the raw source before replacement.
- Keep the pre-import recovery point separate from routine autosave history.
- Never silently drop quantities, warnings, transport requirements, or stage assignments.
