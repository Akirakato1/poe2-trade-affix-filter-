(function attachProfileStore(root) {
  'use strict';

  const SHARE_PREFIX = 'POE2_AFFIX_FILTER_PROFILE:';

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function slug(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'profile';
  }

  function createEmptyFilter() {
    return {
      version: 1,
      subtypeKey: '',
      groups: [],
    };
  }

  function normalizeFilter(filter) {
    const next = filter ? clone(filter) : createEmptyFilter();
    next.subtypeKey = String(next.subtypeKey || '');
    next.groups = Array.isArray(next.groups) ? next.groups : [];

    next.groups = next.groups.map((group) => {
      const normalized = { ...group };
      normalized.rules = Array.isArray(group?.rules) ? group.rules : [];

      if (String(normalized.type || 'and').toLowerCase() === 'count') {
        normalized.type = 'count';
        normalized.count = Number(normalized.count ?? normalized.min ?? 1);
      } else {
        delete normalized.count;
      }

      delete normalized.min;
      delete normalized.max;
      return normalized;
    });

    return next;
  }

  function normalizeTradeLink(value) {
    return String(value || '').trim();
  }

  function isValidTradeLink(value) {
    const text = normalizeTradeLink(value);
    if (!text) {
      return false;
    }

    try {
      const url = new URL(text);
      return url.protocol === 'https:'
        && (url.hostname === 'www.pathofexile.com' || url.hostname === 'pathofexile.com')
        && url.pathname.startsWith('/trade2/');
    } catch (_error) {
      return false;
    }
  }

  function normalizeProfile(profile) {
    return {
      id: String(profile?.id || ''),
      name: String(profile?.name || 'Unnamed profile').trim() || 'Unnamed profile',
      filter: normalizeFilter(profile?.filter),
      tradeLink: normalizeTradeLink(profile?.tradeLink),
      updatedAt: String(profile?.updatedAt || ''),
    };
  }

  function normalizeState(state) {
    const profiles = Array.isArray(state?.profiles) ? state.profiles.map(normalizeProfile) : [];
    const currentProfileId = state?.currentProfileId || '';
    const currentProfile = profiles.find((profile) => profile.id === currentProfileId);
    const hasCurrentTradeLink = Object.prototype.hasOwnProperty.call(state || {}, 'currentTradeLink');
    return {
      profiles,
      currentProfileId,
      currentFilter: normalizeFilter(state?.currentFilter),
      currentTradeLink: normalizeTradeLink(hasCurrentTradeLink ? state.currentTradeLink : currentProfile?.tradeLink),
      liveEnabled: Boolean(state?.liveEnabled),
    };
  }

  function profileIdForName(name, profiles) {
    const base = `profile-${slug(name)}`;
    let candidate = base;
    let index = 2;
    const ids = new Set(profiles.map((profile) => profile.id));
    while (ids.has(candidate)) {
      candidate = `${base}-${index}`;
      index += 1;
    }
    return candidate;
  }

  function profileNameForImport(name, profiles) {
    const base = String(name || '').trim() || 'Imported profile';
    const names = new Set(profiles.map((profile) => profile.name));
    if (!names.has(base)) {
      return base;
    }

    let index = 2;
    let candidate = `${base} ${index}`;
    while (names.has(candidate)) {
      index += 1;
      candidate = `${base} ${index}`;
    }
    return candidate;
  }

  function saveProfile(state, name, filter, tradeLink) {
    const next = normalizeState(state);
    const profileName = String(name || '').trim();
    if (!profileName) {
      throw new Error('Profile name is required');
    }

    const existing = next.profiles.find((profile) => profile.name === profileName);
    const profile = {
      id: existing?.id || profileIdForName(profileName, next.profiles),
      name: profileName,
      filter: normalizeFilter(filter || next.currentFilter),
      tradeLink: normalizeTradeLink(arguments.length >= 4 ? tradeLink : next.currentTradeLink),
      updatedAt: new Date().toISOString(),
    };

    next.profiles = existing
      ? next.profiles.map((candidate) => (candidate.id === existing.id ? profile : candidate))
      : [...next.profiles, profile];
    next.currentProfileId = profile.id;
    next.currentFilter = clone(profile.filter);
    next.currentTradeLink = profile.tradeLink;
    return next;
  }

  function loadProfile(state, profileId) {
    const next = normalizeState(state);
    const profile = next.profiles.find((candidate) => candidate.id === profileId);
    if (!profile) {
      return next;
    }

    next.currentProfileId = profile.id;
    next.currentFilter = clone(profile.filter);
    next.currentTradeLink = profile.tradeLink;
    return next;
  }

  function renameProfile(state, profileId, name) {
    const next = normalizeState(state);
    const profileName = String(name || '').trim();
    if (!profileName) {
      throw new Error('Profile name is required');
    }

    next.profiles = next.profiles.map((profile) => (
      profile.id === profileId
        ? { ...profile, name: profileName, updatedAt: new Date().toISOString() }
        : profile
    ));
    return next;
  }

  function deleteProfile(state, profileId) {
    const next = normalizeState(state);
    next.profiles = next.profiles.filter((profile) => profile.id !== profileId);

    if (next.currentProfileId === profileId) {
      next.currentProfileId = '';
      next.currentFilter = createEmptyFilter();
      next.currentTradeLink = '';
    }

    return next;
  }

  function navigateProfile(state, direction) {
    const next = normalizeState(state);
    if (next.profiles.length === 0) {
      return next;
    }

    const currentIndex = Math.max(
      0,
      next.profiles.findIndex((profile) => profile.id === next.currentProfileId),
    );
    const targetIndex = (currentIndex + direction + next.profiles.length) % next.profiles.length;
    return loadProfile(next, next.profiles[targetIndex].id);
  }

  function setCurrentTradeLink(state, tradeLink) {
    const next = normalizeState(state);
    next.currentTradeLink = normalizeTradeLink(tradeLink);
    if (next.currentProfileId) {
      next.profiles = next.profiles.map((profile) => (
        profile.id === next.currentProfileId
          ? { ...profile, tradeLink: next.currentTradeLink, updatedAt: new Date().toISOString() }
          : profile
      ));
    }
    return next;
  }

  function base64UrlEncode(text) {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(text, 'utf8').toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
    }

    const binary = encodeURIComponent(text).replace(/%([0-9A-F]{2})/g, (_match, hex) => (
      String.fromCharCode(parseInt(hex, 16))
    ));
    return root.btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  function base64UrlDecode(value) {
    const base64 = String(value || '')
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(String(value || '').length / 4) * 4, '=');

    if (typeof Buffer !== 'undefined') {
      return Buffer.from(base64, 'base64').toString('utf8');
    }

    const binary = root.atob(base64);
    const encoded = [...binary].map((char) => (
      `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`
    )).join('');
    return decodeURIComponent(encoded);
  }

  function exportProfileText(state) {
    const next = normalizeState(state);
    const currentProfile = next.profiles.find((profile) => profile.id === next.currentProfileId);
    const payload = {
      version: 1,
      name: currentProfile?.name || 'Unsaved filter',
      tradeLink: next.currentTradeLink,
      filter: normalizeFilter(next.currentFilter),
    };
    return `${SHARE_PREFIX}${base64UrlEncode(JSON.stringify(payload))}`;
  }

  function parseProfileText(text) {
    const value = String(text || '').trim();
    if (!value.startsWith(SHARE_PREFIX)) {
      throw new Error('Import text is not a POE2 affix filter profile');
    }

    const payload = JSON.parse(base64UrlDecode(value.slice(SHARE_PREFIX.length)));
    if (payload?.version !== 1 || !payload.filter || !Array.isArray(payload.filter.groups)) {
      throw new Error('Imported profile is not valid');
    }

    return {
      name: String(payload.name || 'Imported profile').trim() || 'Imported profile',
      tradeLink: normalizeTradeLink(payload.tradeLink),
      filter: normalizeFilter(payload.filter),
    };
  }

  function importProfileText(state, text) {
    const next = normalizeState(state);
    const imported = parseProfileText(text);
    const name = profileNameForImport(imported.name, next.profiles);
    const profile = {
      id: profileIdForName(name, next.profiles),
      name,
      filter: imported.filter,
      tradeLink: imported.tradeLink,
      updatedAt: new Date().toISOString(),
    };

    next.profiles = [...next.profiles, profile];
    next.currentProfileId = profile.id;
    next.currentFilter = clone(profile.filter);
    next.currentTradeLink = profile.tradeLink;
    return next;
  }

  const api = {
    createEmptyFilter,
    deleteProfile,
    exportProfileText,
    importProfileText,
    isValidTradeLink,
    loadProfile,
    navigateProfile,
    normalizeState,
    renameProfile,
    saveProfile,
    setCurrentTradeLink,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.Poe2ProfileStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
