import assert from 'node:assert/strict';
import { test } from 'node:test';

import affixText from '../src/shared/affix-text.js';

const {
  normalizeAffixName,
  parseAffixLabel,
  stripHtml,
} = affixText;

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
  assert.equal(normalizeAffixName('  of the Antidote (>=76) '), 'of the Antidote');
});
