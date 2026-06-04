# POE2 Affix Filter Extension Design

## Purpose

The official Path of Exile 2 trade site can filter by displayed stat values, but this is not precise enough for explicit affix-tier searches. Hybrid modifiers can combine multiple affixes into one displayed stat, so a search for a specific minimum tier of a mod family needs to inspect the explicit affix names shown on each result.

This project will build a Firefox WebExtension that runs on the official POE2 trade site and highlights trade result entries according to user-defined explicit affix-name rules. Passing entries receive a gold border and failing entries receive a red border.

## Scope

The extension will cover all item modifier pages available from PoE2DB's modifier navigation, not only body armour. The shipped extension will use a static bundled affix database generated from PoE2DB. Runtime fetching from PoE2DB is out of scope.

The extension will only filter explicit prefix/suffix affixes. Implicit modifiers, pseudo modifiers, enchantments, corrupted implicits, and aggregate stat roll inference are out of scope because the official trade site already handles many of those cases and because this feature is specifically about affix identity.

## Architecture

The extension will be a Firefox WebExtension loaded by the user through its manifest.

Components:

- `manifest.json`: declares Firefox extension metadata, toolbar action, content script for `https://www.pathofexile.com/trade2/*`, storage permission, active tab permission if needed, and a command/hotkey for toggling live filtering.
- Popup UI: toolbar UI for item-type navigation, rule editing, profile management, live filtering toggle, one-time run button, and hotkey guidance.
- Background script: handles toolbar and hotkey commands, stores global state, and routes messages between the popup and the active trade tab.
- Content script: parses trade result entries, normalizes explicit affix components, evaluates the active filter, applies borders, and observes live search additions when enabled.
- Bundled data: static JSON generated from PoE2DB modifier pages.
- Scraper script: developer-run script that regenerates the bundled JSON when POE2 leagues or modifier data change.

## PoE2DB Data

The scraper will start from `https://poe2db.tw/us/Modifiers` and read the item modifier navigation. The current navigation includes item groups such as weapons, jewellery, gloves, boots, body armours, helmets, off-hands, jewels, flasks, relics, tablets, and waystones. Body armours, for example, are split into `str`, `dex`, `int`, `str_dex`, `str_int`, `dex_int`, and `str_dex_int` subtype pages.

Each modifier page embeds a `new ModsView({...})` payload. The scraper will extract that JSON-like payload and generate normalized data records.

Each item subtype record will include:

- item group, such as `Body Armours`
- subtype key, such as `Body_Armours_dex`
- display label, such as `Body Armours(dex)`
- source URL
- prefix and suffix mod families/categories
- tiered affix entries

Each affix entry will include:

- affix name, such as `Mirage's`
- generation type, prefix or suffix
- PoE2DB family, such as `DefencesPercent`
- required level
- computed tier number
- readable stat text
- tags, such as `Evasion`, `Life`, or `Resistance`

Tier numbering will be computed within each item subtype, generation type, and mod family. `T1` is the best tier, and larger tier numbers are worse tiers. User tier inputs are inclusive, so `minTier=1` and `maxTier=2` allows T1 and T2.

## Trade Page Parsing

Raw requests to `pathofexile.com/trade2` can receive Cloudflare challenges, but the extension runs inside the user's already loaded browser page, so it reads the live DOM instead of fetching the trade page externally.

The current saved trade-page HTML confirms this result markup:

- result entries: `.resultset > .row[data-id]`
- item popup: `.item-popup`
- explicit mods: `.item-mod.item-mod--explicit`
- prefix/suffix and trade-site tier text: left-side labels such as `P2`, `S4`
- affix names: right-side labels such as `Mirage's (>=65)` or hybrid labels such as `Spectre's (>=33) + Antelope's (>=78)`
- pseudo mods: `.item-mod.item-mod--pseudo`, ignored

The content script will normalize each item entry into an explicit affix-name set:

1. Find all `.item-mod.item-mod--explicit` rows inside a result entry.
2. Read the right-side prefix/suffix affix label.
3. Split hybrid labels on ` + `.
4. Strip required-level suffixes such as `(>=65)`.
5. Store normalized affix names in a set for evaluation.

Displayed hybrid mod rows can contribute multiple affix names to the item affix set. A single leaf rule still contributes at most one boolean match.

## Rule Model

The active filter is a global `AND` over top-level one-level groups. Groups contain leaf mod rules only. Repeating the same mod rule across groups is allowed.

Group types:

- `AND`: passes if every child mod rule is true.
- `NOT`: passes if every child mod rule is false.
- `COUNT(min,max)`: counts how many child mod rules are true and passes when `min <= count <= max`.

There is no first-class `OR` group. `OR` behavior is represented as `COUNT(1, M)`.

Leaf mod rule fields:

- selected item subtype
- prefix or suffix
- mod family/category
- minimum tier
- maximum tier

Leaf rule evaluation:

1. Expand the selected family and inclusive tier range into a set of allowed affix names from the bundled data.
2. Compare that set with the item entry's normalized explicit affix-name set.
3. Return true if at least one allowed affix name is present.
4. Return false otherwise.

Each leaf rule contributes only `0` or `1` to a group count. This matches POE affix constraints: two tiers of the same normal prefix/suffix family cannot both appear on one item.

## Popup UI

The popup is the primary user interface and opens from the Firefox toolbar icon.

It will include:

- item group and subtype navigation based on bundled PoE2DB data
- current profile selector
- previous/next profile navigation
- `Reset` to clear the current filter
- `Save` to save the current filter under a name
- `Load` to load a saved filter/profile
- `Rename` to rename a saved profile
- `Delete` to delete a saved profile
- live filtering toggle, default off
- `Run Filter` button for a one-time pass
- top-level group editor
- add group controls for `AND`, `NOT`, and `COUNT`
- child mod-rule rows with prefix/suffix selector, family/category selector, min tier, max tier, and remove control

Saved profiles will persist in Firefox extension storage. A profile contains the selected item subtype, the rule groups, tier ranges, and profile name. Live filtering is off by default; the user may toggle it on. The default hotkey toggles live filtering. One-time filtering is only exposed as a popup button.

## Content Script Behavior

With no active filter configured, the extension applies no borders.

With a filter configured:

- passing entries get a clear gold border
- failing entries get a clear red border
- parse failures are treated as failing entries while a filter is active

`Run Filter` evaluates visible entries once without enabling live mode.

When live filtering is enabled:

1. Evaluate current visible entries immediately.
2. Attach a `MutationObserver` to the result set.
3. Re-evaluate new or changed `.row[data-id]` entries as they appear.

When live filtering is disabled, the extension removes its own borders and stops observing changes.

## Error Handling

The extension must fail softly if the trade page markup changes. It should not break the trade page. If no result entries or no explicit mod rows are found, the popup/status area should report that parsing failed or found no evaluable entries.

If bundled affix data is missing a selected subtype/family, the UI should mark that rule invalid or disable it instead of guessing.

The bundled data should include source URLs and a generated timestamp or version so stale data is visible after league changes.

## Testing

Core logic should be test-driven.

Unit tests:

- PoE2DB payload extraction and tier computation
- all-item navigation extraction from the PoE2DB modifiers page
- trade HTML explicit affix parsing using the saved trade-page fixture
- hybrid affix splitting
- leaf rule tier-range expansion
- `AND`, `NOT`, and `COUNT(min,max)` group evaluation
- no double-counting per leaf rule
- no-filter behavior
- parse-failure behavior

Static checks:

- Firefox manifest shape
- bundled data schema validation
- scraper output validation

Manual verification:

- load the extension into Firefox
- open a POE2 trade result page
- create a filter profile
- run one-time filtering
- toggle live filtering
- confirm gold borders on passing entries and red borders on failing entries
- confirm live search additions are evaluated without refreshing the page

## Open Implementation Notes

The first implementation should prefer DOM parsing because the saved trade page shows all required explicit affix information in the rendered result rows. Hooking the trade site's internal Vue store is not required for the first version and should remain a fallback only if DOM mutation observation proves insufficient.

The scraper should be developer-run, not extension-run. League updates are expected to be infrequent enough that a static bundled snapshot is acceptable.
