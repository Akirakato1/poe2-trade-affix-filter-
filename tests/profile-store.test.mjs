import assert from 'node:assert/strict';
import { test } from 'node:test';

import profileStore from '../src/shared/profile-store.js';

const {
  createEmptyFilter,
  deleteProfile,
  loadProfile,
  navigateProfile,
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
  const state = saveProfile({ profiles: [] }, 'Dex body', sampleFilter);
  assert.equal(state.profiles.length, 1);
  assert.equal(state.profiles[0].name, 'Dex body');
  assert.deepEqual(state.currentFilter, sampleFilter);

  const replaced = saveProfile(state, 'Dex body', { ...sampleFilter, subtypeKey: 'Rings' });
  assert.equal(replaced.profiles.length, 1);
  assert.equal(replaced.profiles[0].filter.subtypeKey, 'Rings');
});

test('loadProfile selects a saved filter by id', () => {
  const state = saveProfile({ profiles: [] }, 'Dex body', sampleFilter);
  const loaded = loadProfile(state, state.profiles[0].id);

  assert.equal(loaded.currentProfileId, state.profiles[0].id);
  assert.deepEqual(loaded.currentFilter, sampleFilter);
});

test('renameProfile changes the profile name without changing the filter', () => {
  const state = saveProfile({ profiles: [] }, 'Dex body', sampleFilter);
  const renamed = renameProfile(state, state.profiles[0].id, 'Fast dex body');

  assert.equal(renamed.profiles[0].name, 'Fast dex body');
  assert.deepEqual(renamed.profiles[0].filter, sampleFilter);
});

test('deleteProfile removes a profile and clears current filter when deleting the active profile', () => {
  const state = saveProfile({ profiles: [] }, 'Dex body', sampleFilter);
  const deleted = deleteProfile(state, state.profiles[0].id);

  assert.equal(deleted.profiles.length, 0);
  assert.equal(deleted.currentProfileId, '');
  assert.deepEqual(deleted.currentFilter, createEmptyFilter());
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
