# PackMap

PackMap combines a local-first travel packing application with a reusable Codex skill. It turns trip details into a practical packing list, then maps every item to a specific suitcase, compartment, or pouch.

PackMap 将旅行时间、目的地、人数、交通方式和洗衣习惯转化为可筛选的行李清单，并继续安排每件物品应该放进哪个箱包、哪一面和哪个收纳袋。

Current release: `0.2.0-beta.1`.

Public Beta: [emillly1.github.io/packmap-travel-packing](https://emillly1.github.io/packmap-travel-packing/) (available after the first Pages deployment).

## Product flow

1. Choose a trip template or start blank.
2. Describe the trip, transport, habits, and available luggage.
3. Review, add, remove, and edit candidate items.
4. Confirm proposed pouches and luggage distribution.
5. Pack from the nested location map.
6. Run transport safety and departure checks.
7. Search, import, export, or print the finished plan.

The application works without AI, accounts, analytics, or a backend. Trip data stays in browser local storage unless the user explicitly exports it. JSON export is lossless; readable TXT and indented exports from the original organizer can also be imported.

## Use the application

```bash
npm install
npm run dev
```

The `main` branch is verified by CI and deployed to GitHub Pages. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the production path and rollback procedure.

## Install the skill

Clone the repository and copy the skill directory into your Codex skills directory:

```bash
git clone https://github.com/Emillly1/packmap-travel-packing.git
cd packmap-travel-packing
mkdir -p ~/.codex/skills
cp -R skills/packmap-travel-packing ~/.codex/skills/
```

Then invoke `$packmap-travel-packing` with a trip description. For example:

```text
Use $packmap-travel-packing to plan a six-month multi-city study trip.
I will travel through warm and cold seasons, do laundry weekly, take two
checked suitcases and one backpack, and want room for shopping.
```

Four anonymous scenarios are available in [examples/SCENARIOS.md](examples/SCENARIOS.md), including a weekend city break, family beach holiday, winter business trip, and six-month study journey.

## Convert skill output

```bash
python3 skills/packmap-travel-packing/scripts/packmap_json_to_text.py \
  examples/long-trip-study-exchange.json \
  -o examples/long-trip-study-exchange.txt
```

## Verification

```bash
npm run typecheck
npm test
npm run build
npm run check:budget
python3 -m unittest discover -s tests -v
```

With the Vite server and a Chrome remote-debugging session running, the repeatable end-to-end test is `npm run test:browser`.

## Repository layout

```text
src/                              Maintainable TypeScript application
public/                           Static artwork and public assets
docs/                             Product, UX, data, and release decisions
skills/packmap-travel-packing/    Reusable Codex skill
examples/                         Anonymous skill scenarios in JSON and TXT
tests/                            TypeScript and Python contract tests
scripts/                          Browser and performance checks
web/index.html                    Preserved original single-file organizer
```

The old repository state is permanently preserved in the `archive/prototype-v1` branch and `prototype-v1` tag.

## Safety scope

PackMap provides packing organization, not medical, legal, immigration, or airline clearance. Verify current airline, border, medication, battery, liquid, and restricted-item rules with the relevant official source.

## License

MIT
