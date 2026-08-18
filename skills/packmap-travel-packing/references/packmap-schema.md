# PackMap JSON Schema

Use this structure when creating data for a packing map or website import.

```json
{
  "schema_version": "1.0",
  "trip": {
    "name": "Europe exchange",
    "origin": "Shanghai",
    "destinations": ["Lyon", "Milan", "Edinburgh"],
    "start_date": "2026-07-01",
    "end_date": "2026-12-22",
    "travelers": 1,
    "trip_type": "study_exchange",
    "laundry_frequency": "weekly",
    "notes": "Multi-season trip with hiking and one formal event.",
    "stages": [
      {
        "id": "summer-course",
        "name": "Summer course",
        "destinations": ["City A"],
        "start_date": "2026-07-01",
        "end_date": "2026-07-31",
        "climate": ["warm", "rain"],
        "activities": ["study", "city trips"]
      }
    ]
  },
  "containers": [
    {
      "id": "samsonite-28",
      "type": "luggage",
      "name": "Samsonite 28 inch",
      "transport": "checked",
      "children": [
        {
          "id": "samsonite-open",
          "type": "compartment",
          "name": "Open side",
          "children": []
        }
      ]
    }
  ],
  "departure_checks": [
    { "id": "passport", "name": "Passport", "checked": false }
  ],
  "warnings": [
    {
      "item": "Power bank",
      "issue": "Must be carry-on",
      "severity": "high"
    }
  ]
}
```

## Node Fields

Every container node:

- `id`: stable lowercase id; hyphenated.
- `type`: `luggage`, `compartment`, `bag`, or `item`.
- `name`: user-facing label.
- `children`: nested nodes; omit or empty for items.

Item-only fields:

- `category`: `documents`, `electronics`, `clothes`, `toiletries`, `medicine`, `beauty`, `daily`, `food`, `other`.
- `packed`: boolean.
- `transport_rule`: `carry_on`, `checked`, or `none`.
- `access`: `airport`, `first_night`, `daily`, `later`, or `any`.
- `risk`: optional short note such as `liquid_leak`, `valuable`, `blade`, `battery`, `fragile`.
- `quantity`: optional user-facing string like `5 pieces`.
- `stage_ids`: optional list of trip stage IDs that use the item.
- `recommendation`: optional `bring`, `buy_local`, `optional`, or `skip`.
- `reason`: optional short explanation tied to a trip fact.

Root fields:

- `schema_version`: use `"1.0"` for the current PackMap website contract.
- `containers`: non-empty list of `luggage` nodes.
- `departure_checks`: optional departure checklist definitions and checked state.
- `warnings`: optional safety or itinerary warnings shown after JSON import.

Trip-stage fields:

- `id`: stable lowercase hyphenated ID.
- `name`: user-facing stage name.
- `destinations`: list of destinations for that stage.
- `start_date` and `end_date`: ISO dates when known.
- `climate`: relevant conditions such as `warm`, `cold`, `rain`, or `wind`.
- `activities`: activity labels used to trigger recommendations.

## Import Text Mapping

When converting to PackMap text:

- `luggage`, `compartment`, and `bag` become plain indented headings.
- `item` becomes `[已装] Name` or `[未装] Name`.
- `transport_rule: carry_on` appends `（必须随身）`.
- `transport_rule: checked` appends `（必须托运）`.
- `quantity` appends ` · Quantity` to the item label so TXT imports remain useful.
- Use two spaces per indentation level.
- TXT intentionally carries only locations, packed state, and transport suffixes. JSON remains the complete source of truth.

## Website Handoff

- Prefer pasting complete JSON into the organizer to retain trip dates, travelers, stages, quantities, recommendations, departure checks, and warnings.
- Use TXT for quick sharing or importing older records. TXT retains hierarchy, packed state, quantity, and transport rules only.
