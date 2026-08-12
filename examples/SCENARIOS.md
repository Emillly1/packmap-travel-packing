# PackMap test scenarios

These examples exercise different planning decisions and website-import paths.

| Scenario | What the skill must reason about | Website checks |
| --- | --- | --- |
| `weekend-city-break.json` | Two travelers, cabin-only limits, shared items, walking comfort | Two carry-on containers, quantities visible, no false checked-bag warning |
| `family-beach-week.json` | Adults plus child, shared supplies, frequent laundry, swimming, sun and motion-sickness needs | Chinese content, three travelers, custom departure checks, imported warnings |
| `winter-business-trip.json` | Formal clothing, work-critical electronics, cold rain, first-night resilience | Three containers, presentation outfit in cabin bag, checked-only item accepted |
| `long-trip-study-exchange.json` | Six months, four stages, two climates, two checked bags, delay kit and shopping buffer | Stage metadata retained in JSON, quantities retained, deliberate location warning shown |

## Example prompts

### Weekend city break

```text
Use $packmap-travel-packing for two people taking a three-day cabin-only city break.
We will walk all day, may get rain, and have one nice dinner. Share items where practical.
Output PackMap JSON for the organizer.
```

### Family beach holiday

```text
请使用 $packmap-travel-packing 规划两位成人和一名儿童的七天海边度假。
酒店可以洗衣，每天游泳，孩子容易晕车。区分共享用品和每人用品，并输出网站可导入 JSON。
```

### Winter business trip

```text
Use $packmap-travel-packing for a five-day winter business trip with meetings,
a presentation, cold rain, a cabin roller, laptop bag, and small checked case.
Protect work-critical and first-night items, then output PackMap JSON.
```

### Long multi-stage study trip

See `long-trip-planning-prompt.md` for the full six-month example.
