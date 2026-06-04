import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import poe2dbParser from '../src/shared/poe2db-parser.js';

const {
  BASE_URL,
  createAffixDataForPage,
  extractModsViewPayload,
  parseModifierNavigation,
} = poe2dbParser;

const MODIFIERS_URL = `${BASE_URL}Modifiers`;
const OUTPUT_PATH = path.resolve('data', 'affixes.json');

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'poe2-trade-affix-filter-data-scraper/0.1',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function scrape() {
  const modifiersHtml = await fetchText(MODIFIERS_URL);
  const groups = parseModifierNavigation(modifiersHtml);
  const pages = groups.flatMap((group) => group.entries.map((entry) => ({
    ...entry,
    group: group.group,
  })));
  const itemTypes = [];
  const failures = [];

  for (const page of pages) {
    try {
      const html = await fetchText(page.url);
      const payload = extractModsViewPayload(html);
      const itemType = createAffixDataForPage(page, payload);
      if (itemType.affixes.length > 0) {
        itemTypes.push(itemType);
      }
      console.log(`scraped ${page.key}: ${itemType.affixes.length} affixes`);
    } catch (error) {
      failures.push({
        key: page.key,
        url: page.url,
        error: error.message,
      });
      console.warn(`skipped ${page.key}: ${error.message}`);
    }
  }

  const data = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: MODIFIERS_URL,
    navigation: groups,
    itemTypes,
    failures,
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

  console.log(`wrote ${OUTPUT_PATH}`);
  console.log(`itemTypes=${itemTypes.length} failures=${failures.length}`);
}

scrape().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
