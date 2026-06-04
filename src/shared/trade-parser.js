(function attachTradeParser(root) {
  'use strict';

  function getAffixTextApi() {
    if (root.Poe2AffixText) {
      return root.Poe2AffixText;
    }
    if (typeof require === 'function') {
      return require('./affix-text.js');
    }
    return {
      parseAffixLabel(value) {
        return String(value || '').split(/\s+\+\s+/).map((part) => part.trim()).filter(Boolean);
      },
      stripHtml(value) {
        return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      },
    };
  }

  function sideFromClass(value) {
    const text = String(value || '');
    if (/\bpr\b/.test(text)) {
      return 'prefix';
    }
    if (/\bsu\b/.test(text)) {
      return 'suffix';
    }
    return 'unknown';
  }

  function uniqueNames(components) {
    return [...new Set(components.map((component) => component.name))];
  }

  function parseExplicitBlock(block) {
    const { parseAffixLabel, stripHtml } = getAffixTextApi();
    const rightMatch = /<span\s+class="lc r ([^"]+)">([\s\S]*?)<\/span>\s*<\/div>/i.exec(block);
    if (!rightMatch) {
      return [];
    }

    const side = sideFromClass(rightMatch[1]);
    const label = stripHtml(rightMatch[2]);
    return parseAffixLabel(label).map((name) => ({ name, side }));
  }

  function explicitBlocksFromHtml(rowHtml) {
    const blocks = [];
    let cursor = 0;
    const marker = '<div class="item-mod item-mod--explicit">';

    while (cursor < rowHtml.length) {
      const start = rowHtml.indexOf(marker, cursor);
      if (start === -1) {
        break;
      }

      const end = rowHtml.indexOf('</div>', start);
      if (end === -1) {
        break;
      }

      blocks.push(rowHtml.slice(start, end + '</div>'.length));
      cursor = end + '</div>'.length;
    }

    return blocks;
  }

  function rowSegmentsFromHtml(html) {
    const starts = [...String(html || '').matchAll(/<div class="row" data-id="([^"]+)"/g)];
    return starts.map((match, index) => {
      const next = starts[index + 1];
      return {
        id: match[1],
        html: String(html).slice(match.index, next ? next.index : undefined),
      };
    });
  }

  function parseTradeResultHtml(html) {
    return rowSegmentsFromHtml(html).map((row) => {
      const components = explicitBlocksFromHtml(row.html).flatMap(parseExplicitBlock);
      return {
        id: row.id,
        components,
        affixNames: uniqueNames(components),
      };
    });
  }

  function parseTradeRowElement(row) {
    const { parseAffixLabel } = getAffixTextApi();
    const components = [];
    const id = row?.getAttribute?.('data-id') || '';
    const modRows = row?.querySelectorAll?.('.item-mod.item-mod--explicit') || [];

    for (const modRow of modRows) {
      const right = modRow.querySelector('.lc.r.pr, .lc.r.su');
      if (!right) {
        continue;
      }

      const side = right.classList.contains('pr') ? 'prefix' : 'suffix';
      for (const name of parseAffixLabel(right.textContent || '')) {
        components.push({ name, side });
      }
    }

    return {
      id,
      components,
      affixNames: uniqueNames(components),
    };
  }

  const api = {
    parseTradeResultHtml,
    parseTradeRowElement,
    sideFromClass,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.Poe2TradeParser = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
