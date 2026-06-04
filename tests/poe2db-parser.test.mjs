import assert from 'node:assert/strict';
import { test } from 'node:test';

import poe2dbParser from '../src/shared/poe2db-parser.js';

const {
  createAffixDataForPage,
  extractModsViewPayload,
  parseModifierNavigation,
} = poe2dbParser;

test('parseModifierNavigation extracts grouped item modifier links', () => {
  const html = `
    <div class="py-1 itemList"><ul>
      <li><span class="disabled">Body Armours</span></li>
      <li><a href="/us/Body_Armours_dex#ModifiersCalc">Body Armours(dex)</a></li>
      <li><a href="/us/Body_Armours_str#ModifiersCalc">Body Armours(str)</a></li>
    </ul></div>
    <div class="py-1 itemList"><ul>
      <li><span class="disabled">Rings</span></li>
      <li><a href="/us/Rings#ModifiersCalc">Rings</a></li>
    </ul></div>
  `;

  assert.deepEqual(parseModifierNavigation(html), [
    {
      group: 'Body Armours',
      entries: [
        {
          key: 'Body_Armours_dex',
          label: 'Body Armours(dex)',
          url: 'https://poe2db.tw/us/Body_Armours_dex',
        },
        {
          key: 'Body_Armours_str',
          label: 'Body Armours(str)',
          url: 'https://poe2db.tw/us/Body_Armours_str',
        },
      ],
    },
    {
      group: 'Rings',
      entries: [
        {
          key: 'Rings',
          label: 'Rings',
          url: 'https://poe2db.tw/us/Rings',
        },
      ],
    },
  ]);
});

test('extractModsViewPayload parses a ModsView JSON payload', () => {
  const html = `<script>$(function(){ new ModsView({"normal":[{"Name":"Mirage's","Level":"65"}]}); });</script>`;

  assert.deepEqual(extractModsViewPayload(html), {
    normal: [
      {
        Name: "Mirage's",
        Level: '65',
      },
    ],
  });
});

test('createAffixDataForPage computes tier groups with T1 as highest required level', () => {
  const page = {
    group: 'Body Armours',
    key: 'Body_Armours_dex',
    label: 'Body Armours(dex)',
    url: 'https://poe2db.tw/us/Body_Armours_dex',
  };
  const payload = {
    normal: [
      {
        Name: "Shade's",
        Level: '2',
        ModGenerationTypeID: '1',
        ModFamilyList: ['DefencesPercent'],
        str: '<span class="mod-value">(15<span class="ndash">—</span>26)</span>% increased <a>Evasion</a> Rating',
        mod_no: ['<span data-tag="evasion">Evasion</span>'],
      },
      {
        Name: "Mirage's",
        Level: '65',
        ModGenerationTypeID: '1',
        ModFamilyList: ['DefencesPercent'],
        str: '<span class="mod-value">(92<span class="ndash">—</span>100)</span>% increased <a>Evasion</a> Rating',
        mod_no: ['<span data-tag="evasion">Evasion</span>'],
      },
      {
        Name: "of the Panther",
        Level: '44',
        ModGenerationTypeID: '2',
        ModFamilyList: ['Dexterity'],
        str: '<span class="mod-value">+(21<span class="ndash">—</span>24)</span> to <a>Dexterity</a>',
        mod_no: ['<span data-tag="attribute">Attribute</span>'],
      },
    ],
  };

  const itemType = createAffixDataForPage(page, payload);
  const evasionGroup = itemType.tierGroups.find((group) => group.family === 'DefencesPercent');

  assert.equal(itemType.affixes.length, 3);
  assert.deepEqual(evasionGroup.affixes.map((affix) => [affix.name, affix.tier]), [
    ["Mirage's", 1],
    ["Shade's", 2],
  ]);
  assert.equal(evasionGroup.generationType, 'prefix');
});
