import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import tradeParser from '../src/shared/trade-parser.js';

const {
  parseTradeResultHtml,
} = tradeParser;

test('parseTradeResultHtml extracts explicit affix components from trade rows', async () => {
  const html = await readFile(new URL('./fixtures/trade-result-sample.html', import.meta.url), 'utf8');
  const rows = parseTradeResultHtml(html);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'sample-1');
  assert.deepEqual(rows[0].affixNames, ["Spectre's", "Antelope's", 'of the Panther']);
});

test('parseTradeResultHtml splits hybrid rows and preserves prefix or suffix side', async () => {
  const html = await readFile(new URL('./fixtures/trade-result-sample.html', import.meta.url), 'utf8');
  const [row] = parseTradeResultHtml(html);

  assert.deepEqual(row.components, [
    { name: "Spectre's", side: 'prefix' },
    { name: "Antelope's", side: 'prefix' },
    { name: 'of the Panther', side: 'suffix' },
  ]);
});

test('parseTradeResultHtml ignores pseudo modifier rows', async () => {
  const html = await readFile(new URL('./fixtures/trade-result-sample.html', import.meta.url), 'utf8');
  const [row] = parseTradeResultHtml(html);

  assert.equal(row.affixNames.includes('1 Empty Modifiers'), false);
});
