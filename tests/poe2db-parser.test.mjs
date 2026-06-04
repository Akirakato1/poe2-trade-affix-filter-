import assert from 'node:assert/strict';
import { test } from 'node:test';

import poe2dbParser from '../src/shared/poe2db-parser.js';

const {
  compactAffixDatabase,
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
    config: {
      normal: {
        title: 'Base',
      },
      essence: {
        title: 'Essence',
      },
      soul: {
        title: '<a href="Medveds_Tending">Medved&apos;s Tending</a>',
      },
    },
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
  assert.equal(evasionGroup.sectionLabel, 'Base');
  assert.deepEqual(evasionGroup.affixes.map((affix) => [affix.name, affix.tier]), [
    ["Mirage's", 1],
    ["Shade's", 2],
  ]);
  assert.equal(evasionGroup.generationType, 'prefix');
});

test('createAffixDataForPage uses PoE2DB config titles as mod type labels', () => {
  const itemType = createAffixDataForPage(
    {
      group: 'Body Armours',
      key: 'Body_Armours_dex',
      label: 'Body Armours(dex)',
      url: 'https://poe2db.tw/us/Body_Armours_dex',
    },
    {
      config: {
        soul: {
          title: '<a href="Medveds_Tending">Medved&apos;s Tending</a>',
        },
      },
      soul: [
        {
          Name: 'Numinous',
          Level: '1',
          ModGenerationTypeID: '1',
          ModFamilyList: ['0'],
          str: '+<span>10</span> to maximum Life',
        },
      ],
    },
  );

  assert.equal(itemType.tierGroups[0].section, 'soul');
  assert.equal(itemType.tierGroups[0].sectionLabel, "Medved's Tending");
  assert.equal(itemType.affixes[0].sectionLabel, "Medved's Tending");
});

test('compactAffixDatabase keeps runtime fields and drops scrape-only metadata', () => {
  const page = {
    group: 'Body Armours',
    key: 'Body_Armours_dex',
    label: 'Body Armours(dex)',
    url: 'https://poe2db.tw/us/Body_Armours_dex',
  };
  const itemType = createAffixDataForPage(page, {
    config: {
      normal: {
        title: 'Base',
      },
    },
    normal: [
      {
        Name: "Shade's",
        Level: '2',
        ModGenerationTypeID: '1',
        ModFamilyList: ['DefencesPercent'],
        str: '<span class="mod-value">(15<span class="ndash">â€”</span>26)</span>% increased <a>Evasion</a> Rating',
        mod_no: ['<span data-tag="evasion">Evasion</span>'],
      },
      {
        Name: "Mirage's",
        Level: '65',
        ModGenerationTypeID: '1',
        ModFamilyList: ['DefencesPercent'],
        str: '<span class="mod-value">(92<span class="ndash">â€”</span>100)</span>% increased <a>Evasion</a> Rating',
        mod_no: ['<span data-tag="evasion">Evasion</span>'],
      },
    ],
  });

  const compact = compactAffixDatabase({
    schemaVersion: 1,
    generatedAt: '2026-06-05T00:00:00.000Z',
    source: 'https://poe2db.tw/us/Modifiers',
    navigation: [
      {
        group: 'Body Armours',
        entries: [
          {
            key: page.key,
            label: page.label,
            url: page.url,
          },
        ],
      },
    ],
    itemTypes: [itemType],
    failures: [],
  });

  assert.equal(compact.schemaVersion, 2);
  assert.deepEqual(compact.navigation, [
    {
      group: 'Body Armours',
      entries: [
        {
          key: page.key,
          label: page.label,
        },
      ],
    },
  ]);

  const compactItemType = compact.itemTypes[0];
  assert.deepEqual(Object.keys(compactItemType).sort(), ['group', 'key', 'label', 'tierGroups'].sort());
  assert.equal(compactItemType.key, page.key);

  const compactGroup = compactItemType.tierGroups[0];
  assert.deepEqual(Object.keys(compactGroup).sort(), [
    'affixes',
    'generationType',
    'key',
    'label',
    'section',
    'sectionLabel',
  ].sort());
  assert.equal(compactGroup.generationType, 'prefix');
  assert.equal(compactGroup.section, 'normal');
  assert.equal(compactGroup.sectionLabel, 'Base');
  assert.deepEqual(compactGroup.affixes, [
    {
      name: "Mirage's",
      tier: 1,
    },
    {
      name: "Shade's",
      tier: 2,
    },
  ]);
});

test('compactAffixDatabase falls back to stable tier group labels when stat text is blank', () => {
  const compact = compactAffixDatabase({
    generatedAt: '2026-06-05T00:00:00.000Z',
    source: 'https://poe2db.tw/us/Modifiers',
    navigation: [],
    itemTypes: [
      {
        key: 'Traps',
        group: 'Traps',
        label: 'Traps',
        tierGroups: [
          {
            key: 'normal:suffix:TrapAndMineThrowSpeed:mod',
            label: '',
            family: 'TrapAndMineThrowSpeed',
            generationType: 'suffix',
            section: 'normal',
            sectionLabel: 'Base',
            affixes: [
              {
                id: 'Traps:normal:tbd:1',
                name: 'TBD',
                tier: 1,
                level: 1,
              },
            ],
          },
        ],
      },
    ],
    failures: [],
  });

  assert.equal(compact.itemTypes[0].tierGroups[0].label, 'TrapAndMineThrowSpeed');
});
