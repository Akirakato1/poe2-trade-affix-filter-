(function attachBackground(root) {
  'use strict';

  const MESSAGE_PREFIX = 'poe2-affix-filter';

  function getBrowserApi() {
    return root.browser || root.chrome || null;
  }

  async function activeTradeTab(api) {
    const tabs = await api.tabs.query({
      active: true,
      currentWindow: true,
    });
    return tabs.find((tab) => /https:\/\/www\.pathofexile\.com\/trade2\//.test(tab.url || '')) || tabs[0];
  }

  async function sendToActiveTab(message) {
    const api = getBrowserApi();
    if (!api?.tabs) {
      return null;
    }

    const tab = await activeTradeTab(api);
    if (!tab?.id) {
      return null;
    }

    return api.tabs.sendMessage(tab.id, {
      namespace: MESSAGE_PREFIX,
      ...message,
    });
  }

  async function setLiveEnabled(enabled) {
    const api = getBrowserApi();
    if (api?.storage?.local) {
      await api.storage.local.set({ liveEnabled: Boolean(enabled) });
    }
    return sendToActiveTab({ type: 'set-live', enabled: Boolean(enabled) });
  }

  async function toggleLiveEnabled() {
    const api = getBrowserApi();
    const stored = api?.storage?.local
      ? await api.storage.local.get(['liveEnabled'])
      : { liveEnabled: false };
    return setLiveEnabled(!stored.liveEnabled);
  }

  function initBackground() {
    const api = getBrowserApi();
    if (!api?.runtime?.onMessage) {
      return;
    }

    api.runtime.onMessage.addListener((message) => {
      if (!message || message.namespace !== MESSAGE_PREFIX) {
        return undefined;
      }

      if (message.type === 'set-live-active-tab') {
        return setLiveEnabled(message.enabled);
      }

      if (message.type === 'toggle-live-active-tab') {
        return toggleLiveEnabled();
      }

      return undefined;
    });

    api.commands?.onCommand?.addListener((command) => {
      if (command === 'toggle-live-filter') {
        toggleLiveEnabled();
      }
    });
  }

  const api = {
    MESSAGE_PREFIX,
    sendToActiveTab,
    setLiveEnabled,
    toggleLiveEnabled,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.Poe2AffixFilterBackground = api;
  initBackground();
})(typeof globalThis !== 'undefined' ? globalThis : window);
