(function attachAffixText(root) {
  'use strict';

  const ENTITY_MAP = {
    amp: '&',
    apos: "'",
    gt: '>',
    ge: '>=',
    lt: '<',
    le: '<=',
    nbsp: ' ',
    quot: '"',
  };

  function decodeEntities(value) {
    return String(value || '').replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
      if (entity[0] === '#') {
        const isHex = entity[1] && entity[1].toLowerCase() === 'x';
        const code = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }

      return Object.prototype.hasOwnProperty.call(ENTITY_MAP, entity) ? ENTITY_MAP[entity] : match;
    });
  }

  function stripHtml(value) {
    return decodeEntities(String(value || '').replace(/<[^>]*>/g, ' '))
      .replace(/\u00a0/g, ' ')
      .replace(/[≥]/g, '>=')
      .replace(/[≤]/g, '<=')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeAffixName(value) {
    return stripHtml(value)
      .replace(/\s*\((?:>=|≤|>=|>|<|=|≥|ilvl|level|req\.?)[^)]*\)\s*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parseAffixLabel(value) {
    const text = stripHtml(value);
    if (!text) {
      return [];
    }

    return text
      .split(/\s+\+\s+/)
      .map(normalizeAffixName)
      .filter(Boolean);
  }

  const api = {
    decodeEntities,
    normalizeAffixName,
    parseAffixLabel,
    stripHtml,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.Poe2AffixText = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
