(function attachPopup(root) {
  'use strict';

  const MESSAGE_PREFIX = 'poe2-affix-filter';
  const TOGGLE_COMMAND = 'toggle-live-filter';
  const UNSET_SHORTCUT_LABEL = 'Not set';
  const store = root.Poe2ProfileStore;
  const modOptions = root.Poe2ModOptions;
  const state = {
    database: null,
    storage: store?.normalizeState ? store.normalizeState({}) : {},
    tradeLinkEditing: true,
    toastTimer: null,
    profileNameMode: '',
  };

  function browserApi() {
    return root.browser || root.chrome;
  }

  function shortcutLabelForCommand(commands, commandName = TOGGLE_COMMAND) {
    const command = (commands || []).find((entry) => entry?.name === commandName);
    const shortcut = String(command?.shortcut || '').trim();
    return shortcut || UNSET_SHORTCUT_LABEL;
  }

  async function browserCommandList(api = browserApi()) {
    if (!api?.commands?.getAll) {
      return [];
    }

    if (api === root.chrome) {
      return new Promise((resolve) => {
        api.commands.getAll((commands) => resolve(commands || []));
      });
    }

    return api.commands.getAll();
  }

  async function renderHotkey() {
    const label = root.document?.getElementById?.('hotkeyLabel');
    if (!label) {
      return;
    }

    try {
      label.textContent = shortcutLabelForCommand(await browserCommandList(), TOGGLE_COMMAND);
    } catch (_error) {
      label.textContent = UNSET_SHORTCUT_LABEL;
    }
  }

  async function openShortcutSettings() {
    const api = browserApi();
    if (api?.commands?.openShortcutSettings) {
      await api.commands.openShortcutSettings();
      return true;
    }
    return false;
  }

  function id() {
    return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function currentFilter() {
    return state.storage.currentFilter || store.createEmptyFilter();
  }

  function currentItemType() {
    return state.database?.itemTypes?.find((itemType) => itemType.key === currentFilter().subtypeKey)
      || state.database?.itemTypes?.[0]
      || null;
  }

  function tierGroupsForCurrentType() {
    const itemType = currentItemType();
    return itemType?.tierGroups || [];
  }

  async function persist() {
    await browserApi().storage.local.set({
      profiles: state.storage.profiles,
      currentProfileId: state.storage.currentProfileId,
      currentFilter: state.storage.currentFilter,
      currentTradeLink: state.storage.currentTradeLink,
      liveEnabled: state.storage.liveEnabled,
    });
  }

  async function sendBackground(type, payload = {}) {
    return browserApi().runtime.sendMessage({
      namespace: MESSAGE_PREFIX,
      type,
      ...payload,
    });
  }

  function setStatus(text) {
    root.document.getElementById('status').textContent = text;
  }

  function setImportPanelVisible(visible) {
    const panel = root.document.getElementById('importPanel');
    panel.hidden = !visible;
    if (visible) {
      root.document.getElementById('importProfileText').focus();
    }
  }

  function setProfileNamePanelVisible(visible) {
    const panel = root.document.getElementById('profileNamePanel');
    panel.hidden = !visible;
    if (!visible) {
      state.profileNameMode = '';
      return;
    }

    const input = root.document.getElementById('profileNameInput');
    input.focus();
    input.select();
  }

  function showProfileNamePanel(mode) {
    state.profileNameMode = mode;
    const current = state.storage.profiles.find((profile) => profile.id === state.storage.currentProfileId);
    const label = root.document.getElementById('profileNameLabel');
    const input = root.document.getElementById('profileNameInput');
    label.textContent = mode === 'rename' ? 'Rename profile' : 'Save profile as';
    input.value = mode === 'rename' ? current?.name || '' : '';
    root.document.getElementById('confirmProfileName').textContent = mode === 'rename' ? 'Rename' : 'Save';
    setProfileNamePanelVisible(true);
  }

  async function saveCurrentProfileQuietly() {
    const current = state.storage.profiles.find((profile) => profile.id === state.storage.currentProfileId);
    if (!current) {
      showProfileNamePanel('save');
      return;
    }

    state.storage = store.saveProfile(state.storage, current.name, currentFilter(), state.storage.currentTradeLink);
    await persist();
    render();
    showToast('Profile saved.');
    setStatus('Profile saved.');
  }

  function showToast(text) {
    const toast = root.document.getElementById('toast');
    toast.textContent = text;
    toast.hidden = false;
    root.clearTimeout?.(state.toastTimer);
    root.requestAnimationFrame?.(() => toast.classList.add('visible'));
    if (!root.requestAnimationFrame) {
      toast.classList.add('visible');
    }
    state.toastTimer = root.setTimeout?.(() => {
      toast.classList.remove('visible');
      root.setTimeout?.(() => {
        toast.hidden = true;
      }, 200);
    }, 2000);
  }

  async function writeClipboardText(text) {
    if (root.navigator?.clipboard?.writeText) {
      await root.navigator.clipboard.writeText(text);
      return;
    }

    const textarea = root.document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    root.document.body.appendChild(textarea);
    textarea.select();
    const copied = root.document.execCommand?.('copy');
    textarea.remove();
    if (!copied) {
      throw new Error('Clipboard is unavailable in this browser.');
    }
  }

  function option(value, label, selected) {
    const node = root.document.createElement('option');
    node.value = value;
    node.textContent = label;
    node.selected = Boolean(selected);
    return node;
  }

  function renderProfiles() {
    const select = root.document.getElementById('profileSelect');
    let hasSelection = false;
    select.replaceChildren();
    for (const profile of state.storage.profiles) {
      select.appendChild(option(profile.id, profile.name, profile.id === state.storage.currentProfileId));
      hasSelection = hasSelection || profile.id === state.storage.currentProfileId;
    }

    if (!hasSelection) {
      select.selectedIndex = -1;
    }
  }

  function renderTradeLink() {
    const input = root.document.getElementById('tradeLinkInput');
    const anchor = root.document.getElementById('tradeLinkAnchor');
    const toggle = root.document.getElementById('tradeLinkToggle');
    const tradeLink = state.storage.currentTradeLink || '';
    const editing = state.tradeLinkEditing || !tradeLink;
    const valid = store.isValidTradeLink?.(tradeLink);

    input.value = tradeLink;
    input.readOnly = !editing;
    toggle.textContent = editing ? '✓' : '✎';
    toggle.title = editing ? 'Save trade link' : 'Edit trade link';
    toggle.setAttribute('aria-label', toggle.title);

    if (!editing && valid) {
      anchor.href = tradeLink;
      anchor.textContent = tradeLink;
      anchor.hidden = false;
      input.hidden = true;
      return;
    }

    anchor.hidden = true;
    anchor.removeAttribute('href');
    anchor.textContent = '';
    input.hidden = false;
  }

  function renderNavigation() {
    const groupSelect = root.document.getElementById('groupSelect');
    const subtypeSelect = root.document.getElementById('subtypeSelect');
    const groups = state.database?.navigation || [];
    const itemType = currentItemType();
    const activeGroup = itemType?.group || groups[0]?.group || '';

    groupSelect.replaceChildren(...groups.map((group) => option(group.group, group.group, group.group === activeGroup)));

    const entries = groups.find((group) => group.group === activeGroup)?.entries || [];
    subtypeSelect.replaceChildren(...entries.map((entry) => option(entry.key, entry.label, entry.key === itemType?.key)));
  }

  function renderGroups() {
    const container = root.document.getElementById('groups');
    const groups = currentFilter().groups || [];
    container.replaceChildren();

    if (groups.length === 0) {
      const empty = root.document.createElement('div');
      empty.className = 'status';
      empty.textContent = 'No groups configured.';
      container.appendChild(empty);
      return;
    }

    for (const group of groups) {
      const groupNode = root.document.createElement('article');
      groupNode.className = 'group';
      groupNode.dataset.groupId = group.id;
      groupNode.innerHTML = `
        <div class="group-header">
          <select data-action="group-type">
            <option value="and">AND</option>
            <option value="not">NOT</option>
            <option value="count">COUNT</option>
          </select>
          <input data-action="group-min" type="number" min="0" value="${Number(group.min ?? 1)}" title="Count min">
          <input data-action="group-max" type="number" min="0" value="${Number(group.max ?? 1)}" title="Count max">
          <button data-action="add-rule" type="button">Add mod</button>
          <button data-action="remove-group" type="button" title="Remove group">x</button>
        </div>
        <div class="rules"></div>
      `;
      groupNode.querySelector('[data-action="group-type"]').value = group.type;
      groupNode.querySelector('[data-action="group-min"]').disabled = group.type !== 'count';
      groupNode.querySelector('[data-action="group-max"]').disabled = group.type !== 'count';

      const rules = groupNode.querySelector('.rules');
      for (const rule of group.rules || []) {
        rules.appendChild(renderRule(rule));
      }

      container.appendChild(groupNode);
    }
  }

  function renderRule(rule) {
    const ruleNode = root.document.createElement('div');
    ruleNode.className = 'rule';
    ruleNode.dataset.ruleId = rule.id;
    const tierGroups = tierGroupsForCurrentType();
    const selection = modOptions.resolveRuleSelection(rule, tierGroups);
    const typeOptions = modOptions.modTypeOptionsForSide(tierGroups, selection.generationType);
    const modEntries = modOptions.modOptionsForSelection(tierGroups, selection.generationType, selection.section);

    ruleNode.appendChild(selectNode('generation-type', [
      ['prefix', 'Prefix'],
      ['suffix', 'Suffix'],
    ], selection.generationType));
    ruleNode.appendChild(selectNode('mod-section', typeOptions.map((entry) => [entry.value, entry.label]), selection.section));
    ruleNode.appendChild(selectNode('tier-group', modEntries.map((entry) => [entry.value, entry.label]), selection.tierGroupKey));
    ruleNode.appendChild(numberNode('min-tier', rule.minTier || 1));
    ruleNode.appendChild(numberNode('max-tier', rule.maxTier || 1));
    const remove = root.document.createElement('button');
    remove.type = 'button';
    remove.dataset.action = 'remove-rule';
    remove.title = 'Remove mod';
    remove.textContent = 'x';
    ruleNode.appendChild(remove);
    return ruleNode;
  }

  function selectNode(action, entries, selected) {
    const select = root.document.createElement('select');
    select.dataset.action = action;
    for (const [value, label] of entries) {
      select.appendChild(option(value, label, value === selected));
    }
    return select;
  }

  function numberNode(action, value) {
    const input = root.document.createElement('input');
    input.dataset.action = action;
    input.type = 'number';
    input.min = '1';
    input.value = String(value);
    return input;
  }

  function render() {
    root.document.getElementById('liveToggle').checked = state.storage.liveEnabled;
    renderProfiles();
    renderTradeLink();
    renderNavigation();
    renderGroups();
  }

  function mutateFilter(mutator) {
    const filter = JSON.parse(JSON.stringify(currentFilter()));
    mutator(filter);
    state.storage.currentFilter = filter;
    return persist().then(render);
  }

  function addGroup(type) {
    return mutateFilter((filter) => {
      filter.groups.push({
        id: id(),
        type,
        min: type === 'count' ? 1 : undefined,
        max: type === 'count' ? 1 : undefined,
        rules: [],
      });
    });
  }

  function findGroup(filter, groupId) {
    return filter.groups.find((group) => group.id === groupId);
  }

  function updateRule(groupId, ruleId, patch) {
    return mutateFilter((filter) => {
      const group = findGroup(filter, groupId);
      const rule = group?.rules?.find((candidate) => candidate.id === ruleId);
      if (rule) {
        Object.assign(rule, patch);
      }
    });
  }

  async function loadInitialState() {
    state.database = await fetch(browserApi().runtime.getURL('data/affixes.json')).then((response) => response.json());
    const stored = await browserApi().storage.local.get(['profiles', 'currentProfileId', 'currentFilter', 'currentTradeLink', 'liveEnabled']);
    state.storage = store.normalizeState(stored);
    if (!state.storage.currentFilter.subtypeKey && state.database.itemTypes[0]) {
      state.storage.currentFilter.subtypeKey = state.database.itemTypes[0].key;
    }
    state.tradeLinkEditing = !state.storage.currentTradeLink;
    await persist();
    render();
  }

  function bindEvents() {
    root.document.getElementById('liveToggle').addEventListener('change', async (event) => {
      state.storage.liveEnabled = event.target.checked;
      await persist();
      const stats = await sendBackground('set-live-active-tab', { enabled: state.storage.liveEnabled });
      setStatus(state.storage.liveEnabled ? `Live on. Evaluated ${stats?.total || 0} entries.` : 'Live off. Borders cleared.');
    });

    root.document.getElementById('hotkeySettings').addEventListener('click', async () => {
      if (await openShortcutSettings()) {
        await renderHotkey();
      } else {
        setStatus('Shortcut settings are unavailable in this browser.');
      }
    });

    root.document.getElementById('newProfile').addEventListener('click', async () => {
      const subtypeKey = currentFilter().subtypeKey;
      state.storage.currentFilter = { ...store.createEmptyFilter(), subtypeKey };
      state.storage.currentProfileId = '';
      state.storage.currentTradeLink = '';
      state.tradeLinkEditing = true;
      await persist();
      render();
      setStatus('New profile started.');
    });

    root.document.getElementById('saveProfile').addEventListener('click', async () => {
      if (state.storage.currentProfileId) {
        await saveCurrentProfileQuietly();
      } else {
        showProfileNamePanel('save');
      }
    });

    root.document.getElementById('cancelProfileName').addEventListener('click', () => {
      setProfileNamePanelVisible(false);
    });

    root.document.getElementById('confirmProfileName').addEventListener('click', async () => {
      const name = root.document.getElementById('profileNameInput').value.trim();
      if (!name) {
        setStatus('Profile name is required.');
        return;
      }

      try {
        if (state.profileNameMode === 'rename') {
          state.storage = store.renameProfile(state.storage, state.storage.currentProfileId, name);
          await persist();
          setProfileNamePanelVisible(false);
          render();
          showToast('Profile renamed.');
          setStatus(`Renamed to ${name}.`);
          return;
        }

        state.storage = store.saveProfile(state.storage, name, currentFilter(), state.storage.currentTradeLink);
        await persist();
        setProfileNamePanelVisible(false);
        render();
        showToast('Profile saved.');
        setStatus(`Saved ${name}.`);
      } catch (error) {
        setStatus(error.message);
      }
    });

    root.document.getElementById('profileNameInput').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        root.document.getElementById('confirmProfileName').click();
      }
      if (event.key === 'Escape') {
        setProfileNamePanelVisible(false);
      }
    });

    root.document.getElementById('shareProfile').addEventListener('click', async () => {
      try {
        await writeClipboardText(store.exportProfileText(state.storage));
        showToast('Profile copied to clipboard.');
        setStatus('Profile copied to clipboard.');
      } catch (error) {
        setStatus(error.message);
      }
    });

    root.document.getElementById('importProfile').addEventListener('click', () => {
      setImportPanelVisible(true);
    });

    root.document.getElementById('cancelImportProfile').addEventListener('click', () => {
      setImportPanelVisible(false);
    });

    root.document.getElementById('confirmImportProfile').addEventListener('click', async () => {
      try {
        state.storage = store.importProfileText(state.storage, root.document.getElementById('importProfileText').value);
        state.tradeLinkEditing = !state.storage.currentTradeLink;
        await persist();
        root.document.getElementById('importProfileText').value = '';
        setImportPanelVisible(false);
        render();
        root.document.getElementById('profileSelect').focus();
        setStatus('Profile imported.');
      } catch (error) {
        setStatus(`Import failed: ${error.message}`);
      }
    });

    root.document.getElementById('profileSelect').addEventListener('change', async (event) => {
      const profileId = event.target.value;
      if (profileId) {
        state.storage = store.loadProfile(state.storage, profileId);
      } else {
        state.storage.currentProfileId = '';
      }
      state.tradeLinkEditing = !state.storage.currentTradeLink;
      await persist();
      render();
      setStatus(profileId ? 'Profile loaded.' : 'No saved profile selected.');
    });

    root.document.getElementById('tradeLinkToggle').addEventListener('click', async () => {
      if (!state.tradeLinkEditing && state.storage.currentTradeLink) {
        state.tradeLinkEditing = true;
        renderTradeLink();
        root.document.getElementById('tradeLinkInput').focus();
        root.document.getElementById('tradeLinkInput').select();
        return;
      }

      const value = root.document.getElementById('tradeLinkInput').value;
      state.storage = store.setCurrentTradeLink(state.storage, value);
      state.tradeLinkEditing = !state.storage.currentTradeLink;
      await persist();
      render();
      setStatus(
        !state.storage.currentTradeLink
          ? 'Trade link cleared.'
          : store.isValidTradeLink(state.storage.currentTradeLink)
            ? 'Trade link saved.'
            : 'Trade link saved. Paste a valid POE2 trade link to make it clickable.',
      );
    });

    root.document.getElementById('tradeLinkInput').addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && state.tradeLinkEditing) {
        event.preventDefault();
        root.document.getElementById('tradeLinkToggle').click();
      }
    });

    root.document.getElementById('renameProfile').addEventListener('click', async () => {
      if (!state.storage.currentProfileId) return;
      showProfileNamePanel('rename');
    });

    root.document.getElementById('deleteProfile').addEventListener('click', async () => {
      const profileId = root.document.getElementById('profileSelect').value;
      if (!profileId || !root.confirm('Delete this saved filter?')) return;
      state.storage = store.deleteProfile(state.storage, profileId);
      await persist();
      render();
      setStatus('Profile deleted.');
    });

    root.document.getElementById('prevProfile').addEventListener('click', async () => {
      state.storage = store.navigateProfile(state.storage, -1);
      state.tradeLinkEditing = !state.storage.currentTradeLink;
      await persist();
      render();
    });

    root.document.getElementById('nextProfile').addEventListener('click', async () => {
      state.storage = store.navigateProfile(state.storage, 1);
      state.tradeLinkEditing = !state.storage.currentTradeLink;
      await persist();
      render();
    });

    root.document.getElementById('groupSelect').addEventListener('change', (event) => {
      const entry = state.database.navigation.find((group) => group.group === event.target.value)?.entries[0];
      if (entry) {
        mutateFilter((filter) => {
          filter.subtypeKey = entry.key;
          filter.groups = [];
        });
      }
    });

    root.document.getElementById('subtypeSelect').addEventListener('change', (event) => {
      mutateFilter((filter) => {
        filter.subtypeKey = event.target.value;
        filter.groups = [];
      });
    });

    root.document.getElementById('addAndGroup').addEventListener('click', () => addGroup('and'));
    root.document.getElementById('addNotGroup').addEventListener('click', () => addGroup('not'));
    root.document.getElementById('addCountGroup').addEventListener('click', () => addGroup('count'));

    root.document.getElementById('groups').addEventListener('change', (event) => {
      const groupNode = event.target.closest('.group');
      const ruleNode = event.target.closest('.rule');
      const action = event.target.dataset.action;
      if (!groupNode || !action) return;

      if (action === 'group-type' || action === 'group-min' || action === 'group-max') {
        mutateFilter((filter) => {
          const group = findGroup(filter, groupNode.dataset.groupId);
          if (!group) return;
          if (action === 'group-type') group.type = event.target.value;
          if (action === 'group-min') group.min = Number(event.target.value);
          if (action === 'group-max') group.max = Number(event.target.value);
        });
      }

      if (ruleNode && action === 'generation-type') {
        const typeOptions = modOptions.modTypeOptionsForSide(tierGroupsForCurrentType(), event.target.value);
        const section = typeOptions[0]?.value || '';
        const firstTierGroup = modOptions.firstTierGroupForSelection(tierGroupsForCurrentType(), event.target.value, section);
        updateRule(groupNode.dataset.groupId, ruleNode.dataset.ruleId, {
          generationType: event.target.value,
          section,
          tierGroupKey: firstTierGroup?.key || '',
        });
      }

      if (ruleNode && action === 'mod-section') {
        const group = findGroup(currentFilter(), groupNode.dataset.groupId);
        const rule = group?.rules?.find((candidate) => candidate.id === ruleNode.dataset.ruleId);
        const generationType = rule?.generationType || 'prefix';
        const firstTierGroup = modOptions.firstTierGroupForSelection(tierGroupsForCurrentType(), generationType, event.target.value);
        updateRule(groupNode.dataset.groupId, ruleNode.dataset.ruleId, {
          section: event.target.value,
          tierGroupKey: firstTierGroup?.key || '',
        });
      }

      if (ruleNode && action === 'tier-group') {
        const tierGroup = tierGroupsForCurrentType().find((group) => group.key === event.target.value);
        updateRule(groupNode.dataset.groupId, ruleNode.dataset.ruleId, {
          generationType: tierGroup?.generationType || 'prefix',
          section: tierGroup?.section || '',
          tierGroupKey: event.target.value,
        });
      }

      if (ruleNode && action === 'min-tier') {
        updateRule(groupNode.dataset.groupId, ruleNode.dataset.ruleId, { minTier: Number(event.target.value) });
      }

      if (ruleNode && action === 'max-tier') {
        updateRule(groupNode.dataset.groupId, ruleNode.dataset.ruleId, { maxTier: Number(event.target.value) });
      }
    });

    root.document.getElementById('groups').addEventListener('click', (event) => {
      const groupNode = event.target.closest('.group');
      const ruleNode = event.target.closest('.rule');
      const action = event.target.dataset.action;
      if (!groupNode || !action) return;

      if (action === 'remove-group') {
        mutateFilter((filter) => {
          filter.groups = filter.groups.filter((group) => group.id !== groupNode.dataset.groupId);
        });
      }

      if (action === 'add-rule') {
        mutateFilter((filter) => {
          const group = findGroup(filter, groupNode.dataset.groupId);
          const firstTierGroup = modOptions.firstTierGroupForSelection(tierGroupsForCurrentType(), 'prefix');
          group.rules.push({
            id: id(),
            generationType: firstTierGroup?.generationType || 'prefix',
            section: firstTierGroup?.section || '',
            tierGroupKey: firstTierGroup?.key || '',
            minTier: 1,
            maxTier: 1,
          });
        });
      }

      if (ruleNode && action === 'remove-rule') {
        mutateFilter((filter) => {
          const group = findGroup(filter, groupNode.dataset.groupId);
          group.rules = group.rules.filter((rule) => rule.id !== ruleNode.dataset.ruleId);
        });
      }
    });
  }

  if (root.document) {
    bindEvents();
    loadInitialState().catch((error) => {
      setStatus(error.message);
    });
    renderHotkey();
  }

  const api = {
    openShortcutSettings,
    renderHotkey,
    shortcutLabelForCommand,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
