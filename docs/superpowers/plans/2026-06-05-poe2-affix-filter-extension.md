# POE2 Affix Filter Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Firefox WebExtension that highlights POE2 trade results by explicit affix-name tier rules backed by a bundled PoE2DB modifier snapshot.

**Architecture:** Use a vanilla JavaScript Firefox extension with a popup, background script, content script, shared parsing/evaluation modules, and generated static affix data. Keep the code dependency-light and test core logic with Node's built-in `node --test` runner.

**Tech Stack:** Firefox WebExtension Manifest V2, vanilla JavaScript ES modules for tests/scripts, CommonJS-compatible browser scripts, Node 22 built-in test runner, built-in `fetch`.

---

## File Structure

- Create `package.json`: test/check/scrape scripts.
- Create `manifest.json`: Firefox extension manifest with toolbar popup, content script, background script, storage permission, and live-toggle command.
- Create `src/shared/affix-text.js`: affix label normalization, HTML stripping/decoding, hybrid affix splitting.
- Create `src/shared/rule-engine.js`: tier-range expansion and filter evaluation.
- Create `src/shared/trade-parser.js`: HTML and DOM explicit-affix extraction.
- Create `src/shared/poe2db-parser.js`: PoE2DB navigation parsing, `ModsView` payload extraction, tier grouping.
- Create `src/content.js`: trade page row parsing, live `MutationObserver`, border application, runtime message handling.
- Create `src/background.js`: hotkey and popup message routing.
- Create `src/popup.html`: toolbar popup shell.
- Create `src/popup.css`: compact popup styling.
- Create `src/popup.js`: data loading, filter editor, profile storage, live toggle, run button.
- Create `scripts/scrape-poe2db.mjs`: generates `data/affixes.json`.
- Create `data/affixes.json`: generated static PoE2DB modifier snapshot.
- Create `tests/*.test.mjs`: unit tests for parsing, tier generation, and rule evaluation.
- Create `tests/fixtures/trade-result-sample.html`: compact fixture based on the saved trade result markup.
- Create `README.md` at the end: install, usage, update, and development instructions.

## Task 1: Project Skeleton

**Files:**
- Create: `package.json`
- Create: `manifest.json`
- Create: `src/shared/affix-text.js`

- [ ] **Step 1: Write a failing affix-text test**

Create `tests/affix-text.test.mjs`:

```js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  normalizeAffixName,
  parseAffixLabel,
  stripHtml,
} from '../src/shared/affix-text.js';

test('stripHtml decodes common saved trade-page entities', () => {
  assert.equal(stripHtml('<span>Mirage&apos;s (&ge;65)</span>'), "Mirage's (>=65)");
});

test('parseAffixLabel splits hybrid affix labels and strips required levels', () => {
  assert.deepEqual(
    parseAffixLabel("Spectre's (>=33) + Antelope's (>=78)"),
    ["Spectre's", "Antelope's"],
  );
});

test('normalizeAffixName trims whitespace and removes required level suffixes', () => {
  assert.equal(normalizeAffixName("  of the Antidote (>=76) "), 'of the Antidote');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/affix-text.test.mjs`

Expected: FAIL because `src/shared/affix-text.js` does not exist.

- [ ] **Step 3: Add project skeleton and affix text implementation**

Create `package.json`, `manifest.json`, and `src/shared/affix-text.js`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/affix-text.test.mjs`

Expected: PASS.

## Task 2: Rule Engine

**Files:**
- Create: `src/shared/rule-engine.js`
- Test: `tests/rule-engine.test.mjs`

- [ ] **Step 1: Write failing rule-engine tests**

Tests cover leaf tier expansion, global AND, NOT, COUNT min/max, and no double-counting per leaf.

- [ ] **Step 2: Run tests to verify failure**

Run: `node --test tests/rule-engine.test.mjs`

Expected: FAIL because `src/shared/rule-engine.js` does not exist.

- [ ] **Step 3: Implement minimal rule engine**

Implement `buildAffixIndex`, `evaluateLeafRule`, `evaluateGroup`, `evaluateFilter`, and `hasConfiguredFilter`.

- [ ] **Step 4: Run tests to verify pass**

Run: `node --test tests/rule-engine.test.mjs`

Expected: PASS.

## Task 3: Trade Result Parser

**Files:**
- Create: `src/shared/trade-parser.js`
- Create: `tests/fixtures/trade-result-sample.html`
- Test: `tests/trade-parser.test.mjs`

- [ ] **Step 1: Write failing parser tests**

Tests parse explicit affix components from saved trade2-like markup, split hybrid rows, ignore pseudo rows, and preserve prefix/suffix side.

- [ ] **Step 2: Run tests to verify failure**

Run: `node --test tests/trade-parser.test.mjs`

Expected: FAIL because parser module does not exist.

- [ ] **Step 3: Implement HTML and DOM parser helpers**

Implement `parseTradeResultHtml` and `parseTradeRowElement`.

- [ ] **Step 4: Run tests to verify pass**

Run: `node --test tests/trade-parser.test.mjs`

Expected: PASS.

## Task 4: PoE2DB Parser And Scraper

**Files:**
- Create: `src/shared/poe2db-parser.js`
- Create: `scripts/scrape-poe2db.mjs`
- Generate: `data/affixes.json`
- Test: `tests/poe2db-parser.test.mjs`

- [ ] **Step 1: Write failing parser tests**

Tests extract modifier navigation links, extract a `new ModsView({...})` payload, compute T1/T2 order by descending required level, and create tier groups.

- [ ] **Step 2: Run tests to verify failure**

Run: `node --test tests/poe2db-parser.test.mjs`

Expected: FAIL because parser module does not exist.

- [ ] **Step 3: Implement parser and scraper**

Implement navigation parsing, payload extraction, affix normalization, tier assignment, and generated data schema.

- [ ] **Step 4: Run parser tests**

Run: `node --test tests/poe2db-parser.test.mjs`

Expected: PASS.

- [ ] **Step 5: Generate bundled data**

Run: `node scripts/scrape-poe2db.mjs`

Expected: `data/affixes.json` exists and contains item subtype records plus tier groups.

## Task 5: Content And Background Scripts

**Files:**
- Create: `src/content.js`
- Create: `src/background.js`
- Test: `tests/content-state.test.mjs`

- [ ] **Step 1: Write failing state tests**

Tests cover class names and style decisions for pass/fail/no-filter states using exported pure helpers.

- [ ] **Step 2: Run tests to verify failure**

Run: `node --test tests/content-state.test.mjs`

Expected: FAIL because helper exports do not exist.

- [ ] **Step 3: Implement content and background scripts**

Implement runtime messages for `run-once`, `set-live`, `get-status`, hotkey live toggle, row evaluation, MutationObserver live mode, and extension-owned border cleanup.

- [ ] **Step 4: Run tests to verify pass**

Run: `node --test tests/content-state.test.mjs`

Expected: PASS.

## Task 6: Popup UI

**Files:**
- Create: `src/popup.html`
- Create: `src/popup.css`
- Create: `src/popup.js`
- Test: `tests/profile-store.test.mjs`

- [ ] **Step 1: Write failing profile tests**

Tests cover reset, save, load, rename, delete, previous profile, and next profile using pure profile-store helpers exported by `src/popup.js` or a shared module.

- [ ] **Step 2: Run tests to verify failure**

Run: `node --test tests/profile-store.test.mjs`

Expected: FAIL because profile helpers do not exist.

- [ ] **Step 3: Implement popup UI and profile helpers**

Implement compact popup rendering, item subtype navigation, group editor, profile management, live toggle, and run button messaging.

- [ ] **Step 4: Run tests to verify pass**

Run: `node --test tests/profile-store.test.mjs`

Expected: PASS.

## Task 7: README And Final Verification

**Files:**
- Create: `README.md`
- Modify: any files needed to fix verification failures

- [ ] **Step 1: Add README**

Document Firefox temporary add-on installation, toolbar usage, profile management, live filtering, one-time filtering, hotkey behavior, scraper update command, and test commands.

- [ ] **Step 2: Run full verification**

Run: `npm test`

Expected: all Node tests pass.

Run: `npm run check`

Expected: manifest and bundled data checks pass.

- [ ] **Step 3: Commit implementation**

Commit with a user-authored message and no `Co-Authored-By` trailer.

- [ ] **Step 4: Add SSH remote and push**

Use only SSH remote URL: `git@github.com:Akirakato1/poe2-trade-affix-filter-.git`.

Run: `git remote add origin git@github.com:Akirakato1/poe2-trade-affix-filter-.git` if no remote exists.

Run: `git push -u origin codex/poe2-affix-filter-extension`.

