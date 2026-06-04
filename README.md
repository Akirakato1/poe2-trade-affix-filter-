# POE2 Trade Affix Filter

Firefox WebExtension for highlighting Path of Exile 2 trade results by explicit affix names and tier ranges.

The official trade site can filter aggregate stat values, but hybrid explicit modifiers can combine multiple affixes into one displayed stat. This extension reads the explicit affix names shown on each trade result, evaluates user rules against a bundled PoE2DB affix snapshot, and marks results directly on the trade page.

## Install In Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click `Load Temporary Add-on`.
3. Select this repository's `manifest.json`.
4. Add or pin `POE2 Affix Filter` to the toolbar if Firefox does not show it automatically.
5. Open a `https://www.pathofexile.com/trade2/...` search page.

Temporary add-ons are removed when Firefox restarts. Load the manifest again after a restart.

## Usage

Click the toolbar icon to open the filter UI.

- Choose an item group and item type from the bundled PoE2DB modifier navigation.
- Add one or more top-level groups.
- Add mod rules inside each group.
- Pick prefix/suffix, mod family, and inclusive min/max tier for each rule.
- Click `Run Filter` for a one-time pass.
- Toggle `Live` to evaluate current and newly appearing live-search entries.
- Use the hotkey button in the popup header to view the current Live shortcut and open Firefox's extension shortcut settings.

Passing entries and item icons receive a gold border. Failing entries and item icons receive a red border. With no configured filter, the extension applies no borders.

Live filtering is off by default. The default hotkey `Ctrl+Shift+F` toggles Live. Firefox can change extension shortcuts from its add-ons shortcut settings, and the popup header provides a shortcut to that page.

## Rule Logic

The active filter is a global AND over one-level groups.

- `AND`: every child mod rule must match.
- `NOT`: every child mod rule must be false.
- `COUNT(min,max)`: counts true child mod rules and passes when the count is within the inclusive range.

There is no separate OR group. Use `COUNT(1, M)` for OR behavior.

Each child mod rule is boolean. A tier range expands to the allowed affix names for that mod family and item type. If the item has any allowed affix name, that rule contributes `1`; otherwise it contributes `0`.

Hybrid trade rows are split by affix name before evaluation, so a displayed row such as `Spectre's + Antelope's` can satisfy two different child rules.

## Saved Filters

The popup supports:

- `Reset`
- `Save`
- `Load`
- `Rename`
- `Delete`
- previous/next profile navigation

Saved filters are stored in Firefox extension storage.

## Update PoE2DB Data

The extension ships a static affix snapshot in `data/affixes.json`.

Regenerate it after league modifier changes:

```powershell
npm run scrape:poe2db
```

The scraper starts from `https://poe2db.tw/us/Modifiers`, follows every modifier page in the navigation, extracts each page's `ModsView` payload, and computes tier groups with `T1` as the highest required-level tier.

## Development

Run tests:

```powershell
npm test
```

Run extension and data checks:

```powershell
npm run check
```

The project intentionally uses no npm dependencies. Core logic is tested with Node's built-in test runner.
