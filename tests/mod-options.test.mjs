import assert from 'node:assert/strict';
import { test } from 'node:test';

import modOptions from '../src/shared/mod-options.js';

const {
  firstTierGroupForSelection,
  modTypeOptionsForSide,
  modOptionsForSelection,
} = modOptions;

const tierGroups = [
  {
    key: 'essence:prefix:EssenceAbyss:flat-life',
    generationType: 'prefix',
    section: 'essence',
    sectionLabel: 'Essence',
    family: 'EssenceAbyss',
    label: '+# to maximum Life',
  },
  {
    key: 'normal:prefix:2618:flat-life',
    generationType: 'prefix',
    section: 'normal',
    sectionLabel: 'Base',
    family: '2618',
    label: '+# to maximum Life',
  },
  {
    key: 'normal:suffix:Dexterity:dexterity',
    generationType: 'suffix',
    section: 'normal',
    sectionLabel: 'Base',
    family: 'Dexterity',
    label: '+# to Dexterity',
  },
];

test('modTypeOptionsForSide groups mod types after prefix or suffix selection', () => {
  assert.deepEqual(modTypeOptionsForSide(tierGroups, 'prefix'), [
    { value: 'normal', label: 'Base' },
    { value: 'essence', label: 'Essence' },
  ]);
});

test('modOptionsForSelection filters by side and mod type and hides family ids in labels', () => {
  assert.deepEqual(modOptionsForSelection(tierGroups, 'prefix', 'essence'), [
    {
      value: 'essence:prefix:EssenceAbyss:flat-life',
      label: '+# to maximum Life',
    },
  ]);
});

test('firstTierGroupForSelection returns first matching group for side and mod type', () => {
  assert.equal(
    firstTierGroupForSelection(tierGroups, 'suffix', 'normal').key,
    'normal:suffix:Dexterity:dexterity',
  );
});

test('firstTierGroupForSelection prefers Base when no mod type is selected', () => {
  assert.equal(
    firstTierGroupForSelection(tierGroups, 'prefix').key,
    'normal:prefix:2618:flat-life',
  );
});
