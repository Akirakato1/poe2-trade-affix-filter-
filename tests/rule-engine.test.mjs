import assert from 'node:assert/strict';
import { test } from 'node:test';

import ruleEngine from '../src/shared/rule-engine.js';

const {
  buildAffixIndex,
  evaluateFilter,
  evaluateLeafRule,
  hasConfiguredFilter,
} = ruleEngine;

const database = {
  itemTypes: [
    {
      key: 'Body_Armours_dex',
      tierGroups: [
        {
          key: 'normal:prefix:DefencesPercent:increased-evasion-rating',
          generationType: 'prefix',
          family: 'DefencesPercent',
          label: '#% increased Evasion Rating',
          affixes: [
            { name: "Illusion's", tier: 1 },
            { name: "Mirage's", tier: 2 },
            { name: "Nightmare's", tier: 3 },
          ],
        },
        {
          key: 'normal:prefix:IncreasedLife:maximum-life',
          generationType: 'prefix',
          family: 'IncreasedLife',
          label: '+# to maximum Life',
          affixes: [
            { name: 'Athlete\'s', tier: 1 },
            { name: 'Rotund', tier: 2 },
          ],
        },
        {
          key: 'normal:suffix:Dexterity:dexterity',
          generationType: 'suffix',
          family: 'Dexterity',
          label: '+# to Dexterity',
          affixes: [
            { name: 'of the Panther', tier: 1 },
            { name: 'of the Falcon', tier: 2 },
          ],
        },
      ],
    },
  ],
};

test('hasConfiguredFilter is false for missing or empty filters', () => {
  assert.equal(hasConfiguredFilter(null), false);
  assert.equal(hasConfiguredFilter({ groups: [] }), false);
});

test('evaluateLeafRule expands inclusive tier ranges to allowed affix names', () => {
  const affixIndex = buildAffixIndex(database);
  const rule = {
    subtypeKey: 'Body_Armours_dex',
    tierGroupKey: 'normal:prefix:DefencesPercent:increased-evasion-rating',
    minTier: 1,
    maxTier: 2,
  };

  assert.equal(evaluateLeafRule(rule, new Set(["Mirage's"]), affixIndex), true);
  assert.equal(evaluateLeafRule(rule, new Set(["Nightmare's"]), affixIndex), false);
});

test('evaluateFilter applies a global AND over top-level groups', () => {
  const filter = {
    subtypeKey: 'Body_Armours_dex',
    groups: [
      {
        type: 'and',
        rules: [
          {
            tierGroupKey: 'normal:prefix:DefencesPercent:increased-evasion-rating',
            minTier: 1,
            maxTier: 2,
          },
          {
            tierGroupKey: 'normal:suffix:Dexterity:dexterity',
            minTier: 1,
            maxTier: 1,
          },
        ],
      },
    ],
  };

  assert.equal(evaluateFilter(filter, new Set(["Mirage's", 'of the Panther']), database).passed, true);
  assert.equal(evaluateFilter(filter, new Set(["Mirage's", 'of the Falcon']), database).passed, false);
});

test('not groups pass only when every child rule is false', () => {
  const filter = {
    subtypeKey: 'Body_Armours_dex',
    groups: [
      {
        type: 'not',
        rules: [
          {
            tierGroupKey: 'normal:suffix:Dexterity:dexterity',
            minTier: 1,
            maxTier: 2,
          },
        ],
      },
    ],
  };

  assert.equal(evaluateFilter(filter, new Set(["Mirage's"]), database).passed, true);
  assert.equal(evaluateFilter(filter, new Set(['of the Falcon']), database).passed, false);
});

test('count groups count boolean child rule matches within min and max', () => {
  const filter = {
    subtypeKey: 'Body_Armours_dex',
    groups: [
      {
        type: 'count',
        min: 2,
        max: 3,
        rules: [
          {
            tierGroupKey: 'normal:prefix:DefencesPercent:increased-evasion-rating',
            minTier: 1,
            maxTier: 2,
          },
          {
            tierGroupKey: 'normal:prefix:IncreasedLife:maximum-life',
            minTier: 1,
            maxTier: 2,
          },
          {
            tierGroupKey: 'normal:suffix:Dexterity:dexterity',
            minTier: 1,
            maxTier: 1,
          },
        ],
      },
    ],
  };

  assert.equal(evaluateFilter(filter, new Set(["Mirage's", 'Rotund']), database).passed, true);
  assert.equal(evaluateFilter(filter, new Set(["Mirage's"]), database).passed, false);
});

test('a leaf rule contributes at most one count even if multiple allowed affix names are present', () => {
  const filter = {
    subtypeKey: 'Body_Armours_dex',
    groups: [
      {
        type: 'count',
        min: 1,
        max: 1,
        rules: [
          {
            tierGroupKey: 'normal:prefix:DefencesPercent:increased-evasion-rating',
            minTier: 1,
            maxTier: 2,
          },
        ],
      },
    ],
  };

  assert.equal(evaluateFilter(filter, new Set(["Illusion's", "Mirage's"]), database).passed, true);
});
