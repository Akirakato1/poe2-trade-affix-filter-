import assert from 'node:assert/strict';
import { test } from 'node:test';

import content from '../src/content.js';

const {
  BORDER_CLASSES,
  ICON_CLASS,
  classForEvaluation,
  statusForEvaluation,
  applyStatus,
  setLiveFiltering,
  stopLiveFiltering,
} = content;

function elementFixture(children = [], options = {}) {
  const classes = new Set();
  return {
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
    },
    querySelectorAll: (selector) => (
      options.selectorMatches?.(selector) === false ? [] : children
    ),
  };
}

test('statusForEvaluation returns none when no filter is configured', () => {
  assert.equal(statusForEvaluation({ hasFilter: false, parsed: true, passed: true }), 'none');
});

test('statusForEvaluation fails parsed rows with no explicit affixes while a filter is active', () => {
  assert.equal(statusForEvaluation({ hasFilter: true, parsed: false, passed: false }), 'fail');
});

test('classForEvaluation maps pass and fail states to extension-owned classes', () => {
  assert.equal(classForEvaluation('pass'), BORDER_CLASSES.pass);
  assert.equal(classForEvaluation('fail'), BORDER_CLASSES.fail);
  assert.equal(classForEvaluation('none'), '');
});

test('applyStatus mirrors pass and fail borders onto item icons', () => {
  const icon = elementFixture();
  const row = elementFixture([icon]);

  applyStatus(row, 'pass');

  assert.equal(row.classList.contains(BORDER_CLASSES.pass), true);
  assert.equal(icon.classList.contains(BORDER_CLASSES.pass), true);

  applyStatus(row, 'fail');

  assert.equal(row.classList.contains(BORDER_CLASSES.pass), false);
  assert.equal(icon.classList.contains(BORDER_CLASSES.pass), false);
  assert.equal(row.classList.contains(BORDER_CLASSES.fail), true);
  assert.equal(icon.classList.contains(BORDER_CLASSES.fail), true);
});

test('applyStatus targets trade-site icon containers, not only img elements', () => {
  const icon = elementFixture();
  const row = elementFixture([icon], {
    selectorMatches: (selector) => selector.includes('.left .icon'),
  });

  applyStatus(row, 'pass');

  assert.equal(icon.classList.contains(BORDER_CLASSES.pass), true);
  assert.equal(icon.classList.contains(ICON_CLASS), true);
});

test('live filtering evaluates rows after the trade site replaces the result set', async () => {
  const originalBrowser = globalThis.browser;
  const originalDocument = globalThis.document;
  const originalFetch = globalThis.fetch;
  const originalMutationObserver = globalThis.MutationObserver;
  const originalParser = globalThis.Poe2TradeParser;
  const originalEngine = globalThis.Poe2RuleEngine;

  function notifyMutation(target) {
    for (const observer of [...target.observers]) {
      observer.callback();
    }
  }

  function targetFixture() {
    return {
      observers: new Set(),
    };
  }

  function rowFixture(affixName) {
    return {
      affixName,
      ...elementFixture(),
    };
  }

  const body = targetFixture();
  const firstResultSet = targetFixture();
  firstResultSet.rows = [rowFixture('Pass')];
  const secondResultSet = targetFixture();
  secondResultSet.rows = [rowFixture('Pass')];
  let currentResultSet = firstResultSet;

  globalThis.browser = {
    runtime: {
      getURL: (path) => path,
    },
    storage: {
      local: {
        get: async () => ({
          currentFilter: { groups: [{ rules: [{ id: 'rule-1' }] }] },
          liveEnabled: true,
        }),
      },
    },
  };
  globalThis.document = {
    body,
    documentElement: {
      appendChild() {},
    },
    createElement: () => ({}),
    getElementById: () => null,
    querySelector: (selector) => (selector === '.resultset' ? currentResultSet : null),
    querySelectorAll: (selector) => (
      selector === '.resultset > .row[data-id]' ? currentResultSet.rows : []
    ),
  };
  globalThis.fetch = async () => ({
    json: async () => ({}),
  });
  globalThis.MutationObserver = class {
    constructor(callback) {
      this.callback = callback;
      this.targets = [];
    }

    observe(target) {
      this.targets.push(target);
      target.observers.add(this);
    }

    disconnect() {
      for (const target of this.targets) {
        target.observers.delete(this);
      }
      this.targets = [];
    }
  };
  globalThis.Poe2TradeParser = {
    parseTradeRowElement: (row) => ({
      affixNames: [row.affixName],
    }),
  };
  globalThis.Poe2RuleEngine = {
    hasConfiguredFilter: () => true,
    evaluateFilter: (_filter, affixNames) => ({
      passed: affixNames.has('Pass'),
    }),
  };

  try {
    await stopLiveFiltering();
    await setLiveFiltering(true);

    assert.equal(firstResultSet.rows[0].classList.contains(BORDER_CLASSES.pass), true);

    currentResultSet = secondResultSet;
    notifyMutation(body);
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(secondResultSet.rows[0].classList.contains(BORDER_CLASSES.pass), true);
  } finally {
    await stopLiveFiltering();
    globalThis.browser = originalBrowser;
    globalThis.document = originalDocument;
    globalThis.fetch = originalFetch;
    globalThis.MutationObserver = originalMutationObserver;
    globalThis.Poe2TradeParser = originalParser;
    globalThis.Poe2RuleEngine = originalEngine;
  }
});
