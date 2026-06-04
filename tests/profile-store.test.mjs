import assert from 'node:assert/strict';
import { test } from 'node:test';

import profileStore from '../src/shared/profile-store.js';

const {
  createEmptyFilter,
  deleteProfile,
  exportProfileText,
  importProfileText,
  isValidTradeLink,
  loadProfile,
  navigateProfile,
  normalizeState,
  renameProfile,
  saveProfile,
} = profileStore;

const sampleFilter = {
  subtypeKey: 'Body_Armours_dex',
  groups: [
    {
      id: 'group-1',
      type: 'and',
      rules: [
        {
          id: 'rule-1',
          tierGroupKey: 'normal:prefix:DefencesPercent:evasion',
          minTier: 1,
          maxTier: 2,
        },
      ],
    },
  ],
};

test('createEmptyFilter returns a blank one-level filter', () => {
  assert.deepEqual(createEmptyFilter(), {
    version: 1,
    subtypeKey: '',
    groups: [],
  });
});

test('saveProfile creates or replaces a named profile', () => {
  const state = saveProfile({ profiles: [] }, 'Dex body', sampleFilter, 'https://www.pathofexile.com/trade2/search/poe2/Standard/abc123');
  assert.equal(state.profiles.length, 1);
  assert.equal(state.profiles[0].name, 'Dex body');
  assert.deepEqual(state.currentFilter, sampleFilter);
  assert.equal(state.currentTradeLink, 'https://www.pathofexile.com/trade2/search/poe2/Standard/abc123');
  assert.equal(state.profiles[0].tradeLink, 'https://www.pathofexile.com/trade2/search/poe2/Standard/abc123');

  const replaced = saveProfile(state, 'Dex body', { ...sampleFilter, subtypeKey: 'Rings' }, '');
  assert.equal(replaced.profiles.length, 1);
  assert.equal(replaced.profiles[0].filter.subtypeKey, 'Rings');
  assert.equal(replaced.profiles[0].tradeLink, '');
});

test('loadProfile selects a saved filter by id', () => {
  const state = saveProfile({ profiles: [] }, 'Dex body', sampleFilter, 'https://www.pathofexile.com/trade2/search/poe2/Standard/abc123');
  const loaded = loadProfile(state, state.profiles[0].id);

  assert.equal(loaded.currentProfileId, state.profiles[0].id);
  assert.deepEqual(loaded.currentFilter, sampleFilter);
  assert.equal(loaded.currentTradeLink, 'https://www.pathofexile.com/trade2/search/poe2/Standard/abc123');
});

test('normalizeState preserves an unsaved working filter between popup opens', () => {
  const state = normalizeState({
    profiles: [],
    currentProfileId: '',
    currentFilter: sampleFilter,
    currentTradeLink: 'https://www.pathofexile.com/trade2/search/poe2/Standard/abc123',
  });

  assert.equal(state.currentProfileId, '');
  assert.equal(state.profiles.length, 0);
  assert.deepEqual(state.currentFilter, sampleFilter);
  assert.equal(state.currentTradeLink, 'https://www.pathofexile.com/trade2/search/poe2/Standard/abc123');
});

test('normalizeState migrates legacy count groups to a single count value', () => {
  const legacyFilter = {
    subtypeKey: 'Body_Armours_dex',
    groups: [
      {
        id: 'group-1',
        type: 'count',
        min: 2,
        max: 4,
        rules: [],
      },
    ],
  };
  const state = normalizeState({
    profiles: [
      {
        id: 'profile-1',
        name: 'Legacy',
        filter: legacyFilter,
      },
    ],
    currentFilter: legacyFilter,
  });

  assert.deepEqual(state.currentFilter.groups[0], {
    id: 'group-1',
    type: 'count',
    count: 2,
    rules: [],
  });
  assert.deepEqual(state.profiles[0].filter.groups[0], state.currentFilter.groups[0]);
});

test('renameProfile changes the profile name without changing the filter', () => {
  const state = saveProfile({ profiles: [] }, 'Dex body', sampleFilter);
  const renamed = renameProfile(state, state.profiles[0].id, 'Fast dex body');

  assert.equal(renamed.profiles[0].name, 'Fast dex body');
  assert.deepEqual(renamed.profiles[0].filter, sampleFilter);
});

test('deleteProfile removes a profile and clears current filter when deleting the active profile', () => {
  const state = saveProfile({ profiles: [] }, 'Dex body', sampleFilter, 'https://www.pathofexile.com/trade2/search/poe2/Standard/abc123');
  const deleted = deleteProfile(state, state.profiles[0].id);

  assert.equal(deleted.profiles.length, 0);
  assert.equal(deleted.currentProfileId, '');
  assert.deepEqual(deleted.currentFilter, createEmptyFilter());
  assert.equal(deleted.currentTradeLink, '');
});

test('navigateProfile moves previous and next through saved profiles', () => {
  let state = saveProfile({ profiles: [] }, 'One', { ...sampleFilter, subtypeKey: 'One' });
  state = saveProfile(state, 'Two', { ...sampleFilter, subtypeKey: 'Two' });
  state = saveProfile(state, 'Three', { ...sampleFilter, subtypeKey: 'Three' });

  const previous = navigateProfile(state, -1);
  assert.equal(previous.currentFilter.subtypeKey, 'Two');

  const next = navigateProfile(previous, 1);
  assert.equal(next.currentFilter.subtypeKey, 'Three');
});

test('isValidTradeLink only accepts Path of Exile 2 trade links', () => {
  assert.equal(isValidTradeLink('https://www.pathofexile.com/trade2/search/poe2/Standard/abc123'), true);
  assert.equal(isValidTradeLink('https://www.pathofexile.com/trade/search/Standard/abc123'), false);
  assert.equal(isValidTradeLink('https://example.com/trade2/search/poe2/Standard/abc123'), false);
  assert.equal(isValidTradeLink(''), false);
});

test('exportProfileText and importProfileText round-trip filter config and trade link', () => {
  const state = saveProfile(
    { profiles: [] },
    'Dex body',
    sampleFilter,
    'https://www.pathofexile.com/trade2/search/poe2/Standard/abc123',
  );
  const text = exportProfileText(state);
  assert.match(text, /^POE2_AFFIX_FILTER_PROFILE:/);

  const imported = importProfileText({ profiles: [] }, text);
  assert.equal(imported.profiles.length, 1);
  assert.equal(imported.currentProfileId, imported.profiles[0].id);
  assert.equal(imported.profiles[0].name, 'Dex body');
  assert.deepEqual(imported.currentFilter, sampleFilter);
  assert.equal(imported.currentTradeLink, 'https://www.pathofexile.com/trade2/search/poe2/Standard/abc123');
});

test('importProfileText creates a unique selected profile when a name already exists', () => {
  const state = saveProfile({ profiles: [] }, 'Dex body', sampleFilter, '');
  const text = exportProfileText(state);
  const imported = importProfileText(state, text);

  assert.equal(imported.profiles.length, 2);
  assert.equal(imported.profiles[1].name, 'Dex body 2');
  assert.equal(imported.currentProfileId, imported.profiles[1].id);
});
