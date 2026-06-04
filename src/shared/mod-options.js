(function attachModOptions(root) {
  'use strict';

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

  function groupsForSide(tierGroups, generationType) {
    return (tierGroups || []).filter((group) => group.generationType === generationType);
  }

  function modTypeOptionsForSide(tierGroups, generationType) {
    const seen = new Set();
    const options = [];

    for (const group of groupsForSide(tierGroups, generationType)) {
      const value = group.section || 'unknown';
      if (seen.has(value)) {
        continue;
      }
      seen.add(value);
      options.push({
        value,
        label: group.sectionLabel || fallbackSectionLabel(value),
      });
    }

    return options.sort((a, b) => {
      if (a.value === 'normal') return -1;
      if (b.value === 'normal') return 1;
      return a.label.localeCompare(b.label);
    });
  }

  function modOptionsForSelection(tierGroups, generationType, section) {
    return groupsForSide(tierGroups, generationType)
      .filter((group) => (group.section || 'unknown') === section)
      .map((group) => ({
        value: group.key,
        label: group.label,
      }));
  }

  function firstTierGroupForSelection(tierGroups, generationType, section) {
    const resolvedSection = section || modTypeOptionsForSide(tierGroups, generationType)[0]?.value || '';
    return groupsForSide(tierGroups, generationType)
      .find((group) => !resolvedSection || (group.section || 'unknown') === resolvedSection)
      || null;
  }

  function resolveRuleSelection(rule, tierGroups) {
    const selectedGroup = (tierGroups || []).find((group) => group.key === rule?.tierGroupKey);
    const generationType = rule?.generationType || selectedGroup?.generationType || 'prefix';
    const section = rule?.section || selectedGroup?.section || modTypeOptionsForSide(tierGroups, generationType)[0]?.value || '';
    const tierGroup = selectedGroup && selectedGroup.generationType === generationType && selectedGroup.section === section
      ? selectedGroup
      : firstTierGroupForSelection(tierGroups, generationType, section);

    return {
      generationType,
      section,
      tierGroupKey: tierGroup?.key || '',
    };
  }

  const api = {
    fallbackSectionLabel,
    firstTierGroupForSelection,
    modOptionsForSelection,
    modTypeOptionsForSide,
    resolveRuleSelection,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.Poe2ModOptions = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
