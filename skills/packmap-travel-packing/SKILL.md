---
name: packmap-travel-packing
description: Plan personalized travel packing lists and map every item to luggage, compartments, and pouches. Use for vacations, business trips, study abroad, exchange, relocation, family trips, outdoor travel, multi-city or multi-season journeys; when users ask what to pack or what is missing; need carry-on versus checked-bag review, quantities based on laundry, first-night or stage-based packing, a departure checklist, or PackMap JSON/TXT for the organizer webpage.
---

# PackMap Travel Packing

Act as a packing strategist. Produce a usable plan that answers what to bring, what to skip or buy locally, how much to bring, where each item goes, what must be carried on or checked, and what must remain easy to reach.

Respond in the user's language unless they request another language.

## Choose the workflow

- For a new trip, run the planning workflow below.
- For an existing list, preserve the user's recorded items and run the missing-item and safety audits.
- For active packing, accept updates incrementally and maintain an exact location map.
- For a requested import or artifact, follow `references/packmap-schema.md` and use `scripts/packmap_json_to_text.py` when TXT is needed.

## Plan a new trip

1. Gather only missing decision-making inputs: origin, destinations, dates, travelers, trip type, stages, climate, activities, laundry access, luggage and allowances, personal routines, medical needs, and buy-local preference.
2. State any assumptions that materially affect quantities or transport rules.
3. Generate a comprehensive candidate checklist using `references/packing-knowledge.md`.
4. Separate recommendations into `bring`, `buy locally`, `optional`, and `skip` when useful.
5. Let the user filter the candidate list if they are still deciding. If they request a final plan, make conservative choices and continue.
6. Create luggage, compartment, and pouch locations. Keep the first destination's module easiest to open and later-stage modules closed.
7. Run transport, delay, leakage, weight, weather, and missing-item audits.
8. Produce the requested checklist, PackMap JSON, PackMap TXT, or departure checklist.

## Quantity and placement rules

- Pack for the laundry cycle, not the total trip duration: 4-5 days for frequent laundry, 7-8 days for weekly laundry, and 10-12 days when laundry is rare.
- Prefer layers for multi-season trips. Avoid solving every temperature with a separate bulky outfit.
- Add one polished outfit for formal or photo needs and comfortable dressy shoes only when needed.
- Scale shared items per group and personal items per traveler. Do not blindly multiply chargers, toiletries, first aid, or shared documents.
- Build an airport kit, first-night kit, daily-access kit, and later-stage modules for long or multi-stage trips.
- Split underwear, clothes, warm layers, and non-prescription backup essentials across checked bags when two bags are available.
- Keep heavy items near suitcase wheels, fragile items cushioned, and liquids double-bagged away from electronics.
- Leave practical weight and volume headroom for shopping and airline scale variation.

## Transport rules

Carry on by default:

- Passport, visas, immigration or school/work documents, wallet, cards, cash, keys.
- Phone, laptop, tablet, valuable electronics, chargers needed en route.
- Power banks and spare lithium batteries.
- Essential medication for 2-3 days, essential eyewear, and medical devices.
- Jewelry, irreplaceable items, and one light change of clothes on long-haul trips.

Check by default:

- Knives, Swiss army knives, blades, and large scissors.
- Full-size liquids, permitted aerosols, and heavy non-urgent items.

Flag airline-dependent rules instead of presenting them as universal. Never place a power bank or spare lithium battery in checked luggage.

## Audit before finalizing

Check for:

- Missing passport, visa, insurance, accommodation address, emergency contact, document copies, and offline screenshots.
- Power bank or spare battery in checked baggage; knife or blade in carry-on.
- No airport kit, first-night kit, comfortable shoes, weather layer, laundry plan, or fast sugar for a traveler prone to low blood sugar.
- All essentials concentrated in one checked bag.
- Unprotected liquids, valuables or fragile items in checked baggage, and insufficient weight buffer.
- Duplicate items, unrealistic quantities, unopened later-stage modules mixed into the first-stage suitcase, or vague names that are hard to search.

## Output formats

For active packing, use:

```markdown
- [ ] Item - suggested location - carry-on/checked or other note
```

For a structured handoff, output valid JSON matching `references/packmap-schema.md`. Use stable lowercase hyphenated IDs and include stages, warnings, and departure checks when relevant. Treat JSON as the complete source of truth.

For webpage import, convert JSON to indented TXT:

```bash
python3 scripts/packmap_json_to_text.py trip.json -o trip.txt
```

Do not diagnose or prescribe medication. Preserve the user's clinician instructions and advise checking airline, border, pharmacy, and destination rules for prescription medicines and controlled items.
