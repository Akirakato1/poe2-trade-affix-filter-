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
  assert.match(html, /class="toggle live-toggle"/);
});

test('popup includes trade link, share, and import controls', async () => {
  const html = await readFile(new URL('../src/popup.html', import.meta.url), 'utf8');

  assert.match(html, /id="tradeLinkInput"/);
  assert.match(html, /id="tradeLinkAnchor"/);
  assert.match(html, /id="tradeLinkToggle"/);
  assert.match(html, /id="shareProfile"/);
  assert.match(html, /id="importProfile"/);
  assert.match(html, /id="newProfile"/);
  assert.match(html, /id="profileNamePanel"/);
  assert.match(html, /id="profileNameInput"/);
  assert.match(html, /id="importPanel"/);
  assert.match(html, /id="importProfileText"/);
  assert.doesNotMatch(html, /id="loadProfile"/);
  assert.doesNotMatch(html, /id="runFilter"/);
  assert.doesNotMatch(html, /id="resetFilter"/);
  assert.doesNotMatch(html, />Run Filter</);
  assert.doesNotMatch(html, />Reset</);
});

test('popup auto-loads profiles from the saved profile dropdown', async () => {
  const source = await readFile(new URL('../src/popup.js', import.meta.url), 'utf8');

  assert.match(source, /getElementById\('profileSelect'\)\.addEventListener\('change'/);
  assert.match(source, /store\.loadProfile\(state\.storage,\s*profileId\)/);
  assert.doesNotMatch(source, /getElementById\('loadProfile'\)\.addEventListener/);
  assert.doesNotMatch(source, /Unsaved filter/);
});

test('popup keeps the current saved profile selected while editing its filter', async () => {
  const source = await readFile(new URL('../src/popup.js', import.meta.url), 'utf8');
  const mutateFilterBody = /function mutateFilter\(mutator\) \{([\s\S]*?)\n  \}/.exec(source)?.[1] || '';

  assert.match(mutateFilterBody, /state\.storage\.currentFilter = filter;/);
  assert.doesNotMatch(mutateFilterBody, /state\.storage\.currentProfileId\s*=\s*''/);
});

test('popup saves and renames profiles without native browser prompts', async () => {
  const source = await readFile(new URL('../src/popup.js', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /root\.prompt/);
  assert.match(source, /showProfileNamePanel\('save'/);
  assert.match(source, /showProfileNamePanel\('rename'/);
  assert.match(source, /if\s*\(state\.storage\.currentProfileId\)/);
  assert.match(source, /showToast\('Profile saved\.'\)/);
  assert.doesNotMatch(source, /getElementById\('runFilter'\)\.addEventListener/);
  assert.doesNotMatch(source, /run-once-active-tab/);
});

test('group count controls render only for COUNT groups', () => {
  assert.equal(popup.groupCountControlsHtml({ type: 'and', min: 2, max: 4 }), '');
  assert.equal(popup.groupCountControlsHtml({ type: 'not', min: 2, max: 4 }), '');

  const html = popup.groupCountControlsHtml({ type: 'count', count: 3 });

  assert.match(html, /data-action="group-count"/);
  assert.doesNotMatch(html, /data-action="group-min"/);
  assert.doesNotMatch(html, /data-action="group-max"/);
  assert.match(html, /value="3"/);
});

test('group count controls read legacy min as the current count', () => {
  const html = popup.groupCountControlsHtml({ type: 'count', min: 2, max: 4 });

  assert.match(html, /data-action="group-count"/);
  assert.match(html, /value="2"/);
  assert.doesNotMatch(html, /value="4"/);
});

test('group headers expose their type for COUNT-specific layout', async () => {
  const source = await readFile(new URL('../src/popup.js', import.meta.url), 'utf8');

  assert.match(source, /data-group-type="\$\{group\.type\}"/);
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
