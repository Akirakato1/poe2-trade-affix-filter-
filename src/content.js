(function attachContentScript(root) {
  'use strict';

  const BORDER_CLASSES = {
    pass: 'poe2-affix-filter-pass',
    fail: 'poe2-affix-filter-fail',
  };
  const MESSAGE_PREFIX = 'poe2-affix-filter';
  const STYLE_ID = 'poe2-affix-filter-style';

  const state = {
    database: null,
    filter: null,
    liveEnabled: false,
    observer: null,
    lastStats: {
      passed: 0,
      failed: 0,
      total: 0,
      parseFailures: 0,
    },
  };

  function getBrowserApi() {
    return root.browser || root.chrome || null;
  }

  function statusForEvaluation({ hasFilter, parsed, passed }) {
    if (!hasFilter) {
      return 'none';
    }
    if (!parsed) {
      return 'fail';
    }
    return passed ? 'pass' : 'fail';
  }

  function classForEvaluation(status) {
    if (status === 'pass') {
      return BORDER_CLASSES.pass;
    }
    if (status === 'fail') {
      return BORDER_CLASSES.fail;
    }
    return '';
  }

  function ensureStyles() {
    if (!root.document || root.document.getElementById(STYLE_ID)) {
      return;
    }

    const style = root.document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${BORDER_CLASSES.pass} {
        outline: 3px solid #d6a229 !important;
        box-shadow: 0 0 0 2px rgba(214, 162, 41, 0.35) !important;
      }
      .${BORDER_CLASSES.fail} {
        outline: 3px solid #b54444 !important;
        box-shadow: 0 0 0 2px rgba(181, 68, 68, 0.28) !important;
      }
    `;
    root.document.documentElement.appendChild(style);
  }

  function clearRow(row) {
    row.classList.remove(BORDER_CLASSES.pass, BORDER_CLASSES.fail);
  }

  function applyStatus(row, status) {
    clearRow(row);
    const className = classForEvaluation(status);
    if (className) {
      row.classList.add(className);
    }
  }

  async function loadDatabase() {
    if (state.database) {
      return state.database;
    }

    const api = getBrowserApi();
    const url = api?.runtime?.getURL
      ? api.runtime.getURL('data/affixes.json')
      : 'data/affixes.json';
    const response = await fetch(url);
    state.database = await response.json();
    return state.database;
  }

  async function loadStoredState() {
    const api = getBrowserApi();
    if (!api?.storage?.local) {
      return;
    }

    const stored = await api.storage.local.get(['currentFilter', 'liveEnabled']);
    state.filter = stored.currentFilter || null;
    state.liveEnabled = Boolean(stored.liveEnabled);
  }

  function resultRows() {
    return [...(root.document?.querySelectorAll?.('.resultset > .row[data-id]') || [])];
  }

  function evaluateRow(row, database) {
    const parser = root.Poe2TradeParser;
    const engine = root.Poe2RuleEngine;
    const hasFilter = engine.hasConfiguredFilter(state.filter);
    if (!hasFilter) {
      applyStatus(row, 'none');
      return { status: 'none', parsed: true, passed: null };
    }

    const parsed = parser.parseTradeRowElement(row);
    const parsedOk = parsed.affixNames.length > 0;
    const result = parsedOk
      ? engine.evaluateFilter(state.filter, new Set(parsed.affixNames), database)
      : { passed: false };
    const status = statusForEvaluation({
      hasFilter,
      parsed: parsedOk,
      passed: result.passed === true,
    });

    applyStatus(row, status);
    return {
      status,
      parsed: parsedOk,
      passed: result.passed === true,
    };
  }

  async function runFilterOnce() {
    ensureStyles();
    await loadStoredState();
    const database = await loadDatabase();
    const stats = {
      passed: 0,
      failed: 0,
      total: 0,
      parseFailures: 0,
    };

    for (const row of resultRows()) {
      const result = evaluateRow(row, database);
      if (result.status === 'none') {
        continue;
      }
      stats.total += 1;
      if (result.status === 'pass') {
        stats.passed += 1;
      } else if (result.status === 'fail') {
        stats.failed += 1;
      }
      if (!result.parsed) {
        stats.parseFailures += 1;
      }
    }

    state.lastStats = stats;
    return stats;
  }

  function stopLiveFiltering() {
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    for (const row of resultRows()) {
      clearRow(row);
    }
  }

  async function startLiveFiltering() {
    await runFilterOnce();
    if (!root.MutationObserver || state.observer) {
      return state.lastStats;
    }

    const target = root.document.querySelector('.resultset') || root.document.body;
    state.observer = new root.MutationObserver(() => {
      runFilterOnce();
    });
    state.observer.observe(target, {
      childList: true,
      subtree: true,
    });
    return state.lastStats;
  }

  async function setLiveFiltering(enabled) {
    state.liveEnabled = Boolean(enabled);
    if (state.liveEnabled) {
      return startLiveFiltering();
    }
    stopLiveFiltering();
    return state.lastStats;
  }

  function initRuntime() {
    const api = getBrowserApi();
    if (!api?.runtime?.onMessage || !root.document) {
      return;
    }

    api.runtime.onMessage.addListener((message) => {
      if (!message || message.namespace !== MESSAGE_PREFIX) {
        return undefined;
      }

      if (message.type === 'run-once') {
        return runFilterOnce();
      }

      if (message.type === 'set-live') {
        return setLiveFiltering(message.enabled);
      }

      if (message.type === 'get-status') {
        return Promise.resolve({
          liveEnabled: state.liveEnabled,
          stats: state.lastStats,
        });
      }

      return undefined;
    });

    loadStoredState().then(() => {
      if (state.liveEnabled) {
        startLiveFiltering();
      }
    });
  }

  const api = {
    BORDER_CLASSES,
    MESSAGE_PREFIX,
    applyStatus,
    classForEvaluation,
    runFilterOnce,
    setLiveFiltering,
    statusForEvaluation,
    stopLiveFiltering,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.Poe2AffixFilterContent = api;
  initRuntime();
})(typeof globalThis !== 'undefined' ? globalThis : window);
