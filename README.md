# PackMap Travel Packing

PackMap is a Codex skill for planning what to pack and where every item should go. It handles short trips, study abroad, exchange, relocation, family travel, outdoor travel, and long multi-city or multi-season journeys.

PackMap 是一个旅行行李规划技能。它不仅生成清单，还会根据行程阶段、气候、活动、洗衣频率、人数和行李额度，安排每件物品应放入哪个箱子、哪一面和哪个收纳袋。

## What it does

- Collects trip facts without forcing a long questionnaire.
- Generates a complete candidate packing list with practical quantities.
- Marks items as bring, buy locally, optional, or skip.
- Plans airport, first-night, daily-access, and later-stage modules.
- Maps items into luggage, compartments, and pouches.
- Audits carry-on versus checked-bag rules, delay risk, liquids, valuables, and weight buffer.
- Creates departure checks and missing-item reviews.
- Exports structured PackMap JSON and organizer-compatible TXT.
- Includes a local, single-file organizer with search, drag and drop, packed status, import, export, and print.

## Install the skill

Clone the repository and copy the skill folder into your Codex skills directory:

```bash
git clone https://github.com/Emillly1/packmap-travel-packing.git
cd packmap-travel-packing
mkdir -p ~/.codex/skills
cp -R skills/packmap-travel-packing ~/.codex/skills/
```

Restart or refresh Codex if the skill does not appear immediately.

## Try it

Invoke `$packmap-travel-packing` and describe your trip:

```text
Use $packmap-travel-packing to plan a six-month multi-city study trip.
I will travel through warm and cold seasons, do laundry weekly, take two
checked suitcases and one backpack, and want room for shopping.
```

The full anonymous long-trip prompt and output are in [`examples/`](examples/).

## Use the organizer

Open [`web/index.html`](web/index.html) directly in a browser. Data stays in that browser's local storage. Use the import button to paste the generated TXT example, or start a new trip in the organizer.

The organizer is a static local demo. It has no account system, server, analytics, or external API calls.

## Convert JSON to import text

```bash
python3 skills/packmap-travel-packing/scripts/packmap_json_to_text.py \
  examples/long-trip-study-exchange.json \
  -o examples/long-trip-study-exchange.txt
```

## Repository layout

```text
skills/packmap-travel-packing/  Codex skill
examples/                       Anonymous long-trip example
web/index.html                  Local PackMap organizer demo
```

## Safety scope

PackMap provides packing organization, not medical, legal, immigration, or airline clearance. Verify current airline, border, medication, battery, liquids, and restricted-item rules with the relevant official source.

## License

MIT
