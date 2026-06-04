(function attachPoe2DbParser(root) {
  'use strict';

  const BASE_URL = 'https://poe2db.tw/us/';

  function getAffixTextApi() {
    if (root.Poe2AffixText) {
      return root.Poe2AffixText;
    }
    if (typeof require === 'function') {
      return require('./affix-text.js');
    }
    return {
      stripHtml(value) {
        return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      },
    };
  }

  function slug(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/&[a-z]+;/g, ' ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'mod';
  }

  function normalizeGenerationType(value) {
    const text = String(value || '').toLowerCase();
    if (text === '1' || text === 'prefix') {
      return 'prefix';
    }
    if (text === '2' || text === 'suffix') {
      return 'suffix';
    }
    return text || 'unknown';
  }

  function parseModifierNavigation(html) {
    const groups = [];
    const groupRegex = /<div class="py-1 itemList">\s*<ul>\s*<li>\s*<span class="disabled">([^<]+)<\/span>\s*<\/li>([\s\S]*?)<\/ul>\s*<\/div>/g;
    let groupMatch;

    while ((groupMatch = groupRegex.exec(String(html || ''))) !== null) {
      const group = getAffixTextApi().stripHtml(groupMatch[1]);
      const body = groupMatch[2];
      const entries = [];
      const linkRegex = /<a\s+[^>]*href="\/us\/([^"#]+)#ModifiersCalc"[^>]*>([\s\S]*?)<\/a>/g;
      let linkMatch;

      while ((linkMatch = linkRegex.exec(body)) !== null) {
        const key = linkMatch[1];
        entries.push({
          key,
          label: getAffixTextApi().stripHtml(linkMatch[2]),
          url: `${BASE_URL}${key}`,
        });
      }

      if (entries.length > 0) {
        groups.push({ group, entries });
      }
    }

    return groups;
  }

  function findMatchingParen(source, openIndex) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    let quote = '';

    for (let index = openIndex; index < source.length; index += 1) {
      const char = source[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === quote) {
          inString = false;
          quote = '';
        }
        continue;
      }

      if (char === '"' || char === "'") {
        inString = true;
        quote = char;
        continue;
      }

      if (char === '(') {
        depth += 1;
      } else if (char === ')') {
        depth -= 1;
        if (depth === 0) {
          return index;
        }
      }
    }

    return -1;
  }

  function extractModsViewPayload(html) {
    const source = String(html || '');
    const marker = 'new ModsView(';
    const start = source.indexOf(marker);
    if (start === -1) {
      throw new Error('ModsView payload not found');
    }

    const openIndex = start + marker.length - 1;
    const closeIndex = findMatchingParen(source, openIndex);
    if (closeIndex === -1) {
      throw new Error('ModsView payload is not closed');
    }

    const json = source.slice(openIndex + 1, closeIndex);
    return JSON.parse(json);
  }

  function plainStatText(entry) {
    const text = getAffixTextApi().stripHtml(entry.str || '');
    return text
      .replace(/[−–—]/g, '-')
      .replace(/\(\s*[-+]?\d+(?:\.\d+)?\s*-\s*[-+]?\d+(?:\.\d+)?\s*\)/g, '(#)')
      .replace(/[-+]?\d+(?:\.\d+)?/g, '#')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tagList(entry) {
    const tags = new Set();
    for (const value of entry.fossil_no || []) {
      tags.add(String(value));
    }
    for (const html of entry.mod_no || []) {
      const tagMatch = /data-tag="([^"]+)"/.exec(String(html));
      if (tagMatch) {
        tags.add(tagMatch[1]);
      }
      const text = getAffixTextApi().stripHtml(html);
      if (text) {
        tags.add(text);
      }
    }
    return [...tags].filter(Boolean).sort();
  }

  function familyList(entry) {
    const families = Array.isArray(entry.ModFamilyList) ? entry.ModFamilyList : [];
    return families.length > 0 ? families.map(String) : ['UnknownFamily'];
  }

  function arraySections(payload) {
    return Object.entries(payload || {})
      .filter(([, value]) => Array.isArray(value))
      .filter(([, value]) => value.some((entry) => entry && entry.Name && entry.ModGenerationTypeID));
  }

  function fallbackSectionLabel(section) {
    if (section === 'normal') {
      return 'Base';
    }
    return String(section || '')
      .split(/[_-]+/g)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || 'Unknown';
  }

  function sectionLabel(payload, section) {
    const configTitle = payload?.config?.[section]?.title;
    const text = getAffixTextApi().stripHtml(configTitle || '');
    return text || fallbackSectionLabel(section);
  }

  function firstNonEmptyString(...values) {
    for (const value of values) {
      const text = String(value || '').trim();
      if (text) {
        return text;
      }
    }
    return '';
  }

  function createAffixDataForPage(page, payload) {
    const affixes = [];
    let order = 0;

    for (const [section, entries] of arraySections(payload)) {
      const currentSectionLabel = sectionLabel(payload, section);
      for (const entry of entries) {
        const generationType = normalizeGenerationType(entry.ModGenerationTypeID);
        if (generationType !== 'prefix' && generationType !== 'suffix') {
          continue;
        }

        const families = familyList(entry);
        const statText = plainStatText(entry);
        const statKey = slug(statText);
        const family = families.join('+');
        const tierGroupKey = `${section}:${generationType}:${family}:${statKey}`;

        affixes.push({
          id: `${page.key}:${section}:${slug(entry.Name)}:${order}`,
          name: String(entry.Name || '').trim(),
          generationType,
          generationTypeId: String(entry.ModGenerationTypeID || ''),
          family,
          families,
          level: Number(entry.Level || 0),
          section,
          sectionLabel: currentSectionLabel,
          statText,
          statKey,
          tags: tagList(entry),
          tierGroupKey,
          sourceUrl: page.url,
          order,
        });
        order += 1;
      }
    }

    const groupsByKey = new Map();
    for (const affix of affixes) {
      if (!groupsByKey.has(affix.tierGroupKey)) {
        groupsByKey.set(affix.tierGroupKey, []);
      }
      groupsByKey.get(affix.tierGroupKey).push(affix);
    }

    const tierGroups = [...groupsByKey.entries()].map(([key, groupAffixes]) => {
      const sorted = [...groupAffixes].sort((a, b) => (
        b.level - a.level || a.order - b.order
      ));
      const tiered = sorted.map((affix, index) => ({
        name: affix.name,
        tier: index + 1,
        level: affix.level,
        id: affix.id,
      }));

      for (const tierAffix of tiered) {
        const affix = affixes.find((candidate) => candidate.id === tierAffix.id);
        if (affix) {
          affix.tier = tierAffix.tier;
        }
      }

      return {
        key,
        label: groupAffixes[0].statText,
        family: groupAffixes[0].family,
        generationType: groupAffixes[0].generationType,
        section: groupAffixes[0].section,
        sectionLabel: groupAffixes[0].sectionLabel,
        tags: [...new Set(groupAffixes.flatMap((affix) => affix.tags))].sort(),
        affixes: tiered,
      };
    }).sort((a, b) => (
      a.generationType.localeCompare(b.generationType)
      || a.family.localeCompare(b.family)
      || a.label.localeCompare(b.label)
    ));

    return {
      key: page.key,
      label: page.label,
      group: page.group,
      url: page.url,
      affixes,
      tierGroups,
    };
  }

  function compactAffixDatabase(database) {
    return {
      schemaVersion: 2,
      generatedAt: String(database?.generatedAt || ''),
      source: String(database?.source || ''),
      navigation: (database?.navigation || []).map((group) => ({
        group: String(group.group || ''),
        entries: (group.entries || []).map((entry) => ({
          key: String(entry.key || ''),
          label: String(entry.label || ''),
        })),
      })),
      itemTypes: (database?.itemTypes || []).map((itemType) => ({
        key: String(itemType.key || ''),
        group: String(itemType.group || ''),
        label: String(itemType.label || ''),
        tierGroups: (itemType.tierGroups || []).map((group) => ({
          key: String(group.key || ''),
          label: firstNonEmptyString(group.label, group.family, group.key),
          generationType: normalizeGenerationType(group.generationType),
          section: String(group.section || ''),
          sectionLabel: String(group.sectionLabel || ''),
          affixes: (group.affixes || []).map((affix) => ({
            name: String(affix.name || '').trim(),
            tier: Number(affix.tier || 0),
          })),
        })),
      })),
      failures: (database?.failures || []).map((failure) => ({
        key: String(failure.key || ''),
        url: String(failure.url || ''),
        error: String(failure.error || ''),
      })),
    };
  }

  const api = {
    BASE_URL,
    compactAffixDatabase,
    createAffixDataForPage,
    extractModsViewPayload,
    parseModifierNavigation,
    plainStatText,
    sectionLabel,
    slug,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.Poe2DbParser = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
