import { readFile } from 'node:fs/promises';

const REQUIRED_FILES = [
  'manifest.json',
  'src/background.js',
  'src/content.js',
  'src/popup.html',
  'src/popup.css',
  'src/popup.js',
  'src/shared/affix-text.js',
  'src/shared/mod-options.js',
  'src/shared/poe2db-parser.js',
  'src/shared/profile-store.js',
  'src/shared/rule-engine.js',
  'src/shared/trade-parser.js',
  'data/affixes.json',
];

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function checkFiles() {
  for (const file of REQUIRED_FILES) {
    await readFile(file, 'utf8');
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function checkManifest() {
  const manifest = await readJson('manifest.json');
  assert(manifest.manifest_version === 2, 'manifest_version must be 2 for Firefox temporary add-on compatibility');
  assert(manifest.browser_action?.default_popup === 'src/popup.html', 'toolbar popup must be src/popup.html');
  assert(manifest.content_scripts?.[0]?.matches?.includes('https://www.pathofexile.com/trade2/*'), 'trade2 content script match is missing');
  assert(manifest.commands?.['toggle-live-filter'], 'toggle-live-filter command is missing');
  assert(manifest.permissions?.includes('storage'), 'storage permission is missing');
}

async function checkAffixData() {
  const data = await readJson('data/affixes.json');
  assert(data.schemaVersion === 2, 'affix data schemaVersion must be 2');
  assert(data.generatedAt, 'affix data generatedAt is missing');
  assert(data.source === 'https://poe2db.tw/us/Modifiers', 'affix data source is unexpected');
  assert(Array.isArray(data.navigation) && data.navigation.length > 0, 'affix navigation is empty');
  assert(Array.isArray(data.itemTypes) && data.itemTypes.length > 0, 'affix itemTypes is empty');
  assert(Array.isArray(data.failures) && data.failures.length === 0, 'affix scrape failures must be empty');

  const firstNavigationEntry = data.navigation[0]?.entries?.[0];
  assert(firstNavigationEntry?.key && firstNavigationEntry?.label, 'affix navigation entries must include key and label');
  assert(!('url' in firstNavigationEntry), 'compact affix navigation must not include entry urls');

  let totalTierGroups = 0;
  let totalAffixes = 0;
  for (const itemType of data.itemTypes) {
    assert(itemType.key && itemType.group && itemType.label, 'affix itemType is missing runtime labels');
    assert(Array.isArray(itemType.tierGroups), 'affix itemType tierGroups must be an array');
    assert(!('affixes' in itemType), 'compact affix itemTypes must not include top-level affixes');
    assert(!('url' in itemType), 'compact affix itemTypes must not include urls');

    totalTierGroups += itemType.tierGroups.length;
    for (const group of itemType.tierGroups) {
      assert(group.key && group.label, 'affix tierGroup is missing key or label');
      assert(group.generationType === 'prefix' || group.generationType === 'suffix', 'affix tierGroup generationType is invalid');
      assert(group.section && group.sectionLabel, 'affix tierGroup is missing section labels');
      assert(Array.isArray(group.affixes), 'affix tierGroup affixes must be an array');
      assert(!('family' in group), 'compact affix tierGroups must not include family metadata');
      assert(!('tags' in group), 'compact affix tierGroups must not include tag metadata');

      for (const affix of group.affixes) {
        totalAffixes += 1;
        assert(affix.name, 'compact affix is missing name');
        assert(Number.isInteger(affix.tier) && affix.tier > 0, 'compact affix tier must be a positive integer');
        assert(!('id' in affix), 'compact affixes must not include ids');
        assert(!('level' in affix), 'compact affixes must not include levels');
      }
    }
  }

  assert(totalAffixes > 1000, 'affix snapshot is unexpectedly small');
  assert(totalTierGroups > 100, 'tier-group snapshot is unexpectedly small');
}

async function main() {
  await checkFiles();
  await checkManifest();
  await checkAffixData();
  console.log('extension checks passed');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
