(function attachProfileStore(root) {
  'use strict';

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

  function normalizeState(state) {
    return {
      profiles: Array.isArray(state?.profiles) ? clone(state.profiles) : [],
      currentProfileId: state?.currentProfileId || '',
      currentFilter: state?.currentFilter ? clone(state.currentFilter) : createEmptyFilter(),
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

  function saveProfile(state, name, filter) {
    const next = normalizeState(state);
    const profileName = String(name || '').trim();
    if (!profileName) {
      throw new Error('Profile name is required');
    }

    const existing = next.profiles.find((profile) => profile.name === profileName);
    const profile = {
      id: existing?.id || profileIdForName(profileName, next.profiles),
      name: profileName,
      filter: clone(filter || next.currentFilter || createEmptyFilter()),
      updatedAt: new Date().toISOString(),
    };

    next.profiles = existing
      ? next.profiles.map((candidate) => (candidate.id === existing.id ? profile : candidate))
      : [...next.profiles, profile];
    next.currentProfileId = profile.id;
    next.currentFilter = clone(profile.filter);
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

  const api = {
    createEmptyFilter,
    deleteProfile,
    loadProfile,
    navigateProfile,
    normalizeState,
    renameProfile,
    saveProfile,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.Poe2ProfileStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
