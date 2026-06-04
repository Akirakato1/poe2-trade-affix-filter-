import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const originalProfileStore = globalThis.Poe2ProfileStore;
globalThis.Poe2ProfileStore = {
  normalizeState: () => ({}),
};
const popup = (await import('../src/popup.js')).default;
globalThis.Poe2ProfileStore = originalProfileStore;

test('popup header includes current hotkey display and settings button', async () => {
  const html = await readFile(new URL('../src/popup.html', import.meta.url), 'utf8');

  assert.match(html, /id="hotkeyLabel"/);
  assert.match(html, /id="hotkeySettings"/);
});

test('shortcutLabelForCommand displays assigned and unset shortcuts', () => {
  assert.equal(
    popup.shortcutLabelForCommand([
      { name: 'toggle-live-filter', shortcut: 'Ctrl+Shift+F' },
    ], 'toggle-live-filter'),
    'Ctrl+Shift+F',
  );

  assert.equal(
    popup.shortcutLabelForCommand([
      { name: 'toggle-live-filter', shortcut: '' },
    ], 'toggle-live-filter'),
    'Not set',
  );

  assert.equal(popup.shortcutLabelForCommand([], 'toggle-live-filter'), 'Not set');
});

test('openShortcutSettings delegates to the browser commands API', async () => {
  const originalBrowser = globalThis.browser;
  let opened = false;
  globalThis.browser = {
    commands: {
      openShortcutSettings: async () => {
        opened = true;
      },
    },
  };

  try {
    assert.equal(await popup.openShortcutSettings(), true);
    assert.equal(opened, true);
  } finally {
    globalThis.browser = originalBrowser;
  }
});
