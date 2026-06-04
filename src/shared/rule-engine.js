(function attachRuleEngine(root) {
  'use strict';

  function getAffixTextApi() {
    if (root.Poe2AffixText) {
      return root.Poe2AffixText;
    }
    if (typeof require === 'function') {
      return require('./affix-text.js');
    }
    return {
      normalizeAffixName(value) {
        return String(value || '').trim();
      },
    };
  }

  function normalizeGenerationType(value) {
    const text = String(value || '').toLowerCase();
    if (text === '1' || text === 'prefix') {
      return 'prefix';
    }
    if (text === '2' || text === 'suffix') {
      return 'suffix';
    }
    return text;
  }

  function makeTierGroupKey(subtypeKey, tierGroupKey) {
    return `${subtypeKey || ''}::${tierGroupKey || ''}`;
  }

  function buildAffixIndex(database) {
    const { normalizeAffixName } = getAffixTextApi();
    const tierGroups = new Map();

    for (const itemType of database?.itemTypes || []) {
      for (const group of itemType.tierGroups || []) {
        const affixes = (group.affixes || []).map((affix) => ({
          ...affix,
          name: normalizeAffixName(affix.name),
          tier: Number(affix.tier),
        }));
        tierGroups.set(makeTierGroupKey(itemType.key, group.key), {
          ...group,
          generationType: normalizeGenerationType(group.generationType),
          subtypeKey: itemType.key,
          affixes,
        });
      }
    }

    return { tierGroups };
  }

  function hasConfiguredFilter(filter) {
    return Boolean(
      filter
      && Array.isArray(filter.groups)
      && filter.groups.some((group) => Array.isArray(group.rules) && group.rules.length > 0),
    );
  }

  function getAllowedAffixNames(rule, affixIndex) {
    const subtypeKey = rule.subtypeKey || rule.itemTypeKey || '';
    const key = makeTierGroupKey(subtypeKey, rule.tierGroupKey);
    const group = affixIndex.tierGroups.get(key);
    if (!group) {
      return [];
    }

    const minTier = Number(rule.minTier || 1);
    const maxTier = Number(rule.maxTier || minTier);
    const lower = Math.min(minTier, maxTier);
    const upper = Math.max(minTier, maxTier);

    return group.affixes
      .filter((affix) => affix.tier >= lower && affix.tier <= upper)
      .map((affix) => affix.name);
  }

  function evaluateLeafRule(rule, itemAffixNames, affixIndex) {
    const { normalizeAffixName } = getAffixTextApi();
    const itemSet = itemAffixNames instanceof Set
      ? itemAffixNames
      : new Set((itemAffixNames || []).map(normalizeAffixName));
    const allowed = getAllowedAffixNames(rule, affixIndex);

    return allowed.some((name) => itemSet.has(name));
  }

  function withSubtype(rule, subtypeKey) {
    return {
      ...rule,
      subtypeKey: rule.subtypeKey || subtypeKey,
    };
  }

  function evaluateGroup(group, itemAffixNames, affixIndex, subtypeKey) {
    const rules = (group.rules || []).map((rule) => withSubtype(rule, subtypeKey));
    const matches = rules.map((rule) => evaluateLeafRule(rule, itemAffixNames, affixIndex));
    const type = String(group.type || 'and').toLowerCase();

    if (type === 'not') {
      return {
        passed: matches.every((matched) => !matched),
        matchedCount: matches.filter(Boolean).length,
        matches,
      };
    }

    if (type === 'count') {
      const matchedCount = matches.filter(Boolean).length;
      const min = Number(group.min || 0);
      const max = Number(group.max ?? rules.length);
      return {
        passed: matchedCount >= min && matchedCount <= max,
        matchedCount,
        matches,
      };
    }

    return {
      passed: matches.every(Boolean),
      matchedCount: matches.filter(Boolean).length,
      matches,
    };
  }

  function evaluateFilter(filter, itemAffixNames, databaseOrIndex) {
    if (!hasConfiguredFilter(filter)) {
      return {
        passed: null,
        reason: 'no-filter',
        groupResults: [],
      };
    }

    const affixIndex = databaseOrIndex?.tierGroups instanceof Map
      ? databaseOrIndex
      : buildAffixIndex(databaseOrIndex);
    const groupResults = (filter.groups || []).map((group) => (
      evaluateGroup(group, itemAffixNames, affixIndex, filter.subtypeKey)
    ));

    return {
      passed: groupResults.every((result) => result.passed),
      groupResults,
    };
  }

  const api = {
    buildAffixIndex,
    evaluateFilter,
    evaluateGroup,
    evaluateLeafRule,
    getAllowedAffixNames,
    hasConfiguredFilter,
    normalizeGenerationType,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.Poe2RuleEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
