import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

function declarationBlock(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`${escaped}\\s*\\{([^}]+)\\}`, 'm').exec(css);
  return match?.[1] || '';
}

test('popup grows with content until the viewport cap, then scrolls', async () => {
  const css = await readFile(new URL('../src/popup.css', import.meta.url), 'utf8');
  const body = declarationBlock(css, 'body');
  const popup = declarationBlock(css, '.popup');
  const groups = declarationBlock(css, '.groups');

  assert.match(body, /width:\s*\d+px;/);
  assert.doesNotMatch(body, /(?:^|\s)height:\s*\d+px;/);
  assert.match(body, /max-height:\s*920px;/);
  assert.doesNotMatch(body, /100vh/);
  assert.match(body, /overflow-x:\s*hidden;/);
  assert.match(body, /overflow-y:\s*auto;/);
  assert.doesNotMatch(popup, /grid-template-rows:/);
  assert.doesNotMatch(popup, /height:\s*100%;/);
  assert.doesNotMatch(popup, /overflow:\s*hidden;/);
  assert.match(groups, /align-content:\s*start;/);
  assert.doesNotMatch(groups, /overflow:\s*auto;/);
});
