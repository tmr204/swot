// Persistence (localStorage on this phone), backups, and sharing between phones.

import { DEFAULT_SETTINGS } from './planner.js';

const KEY = 'family-meal-planner.v1';

export function defaultState() {
  return {
    version: 1,
    settings: structuredClone(DEFAULT_SETTINGS),
    weeks: {},
    customRecipes: [],
    lastNotified: '',
  };
}

function withDefaults(state) {
  const base = defaultState();
  return {
    ...base,
    ...state,
    settings: { ...base.settings, ...(state.settings || {}), mix: { ...base.settings.mix, ...(state.settings?.mix || {}) } },
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? withDefaults(JSON.parse(raw)) : defaultState();
  } catch {
    return defaultState();
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

// ----------------------------------------------------------- sharing

function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** A link containing one week's plan (and any custom meals it uses). */
export function weekShareLink(baseUrl, week, customRecipes) {
  const ids = new Set(week.days.map((d) => d.recipeId));
  const payload = {
    kind: 'week',
    week: {
      start: week.start,
      days: week.days.map(({ date, recipeId, slot, explore, locked, eaters }) => ({ date, recipeId, slot, explore, locked, eaters })),
      extras: week.extras,
    },
    customRecipes: customRecipes.filter((r) => ids.has(r.id)),
  };
  return `${baseUrl}#share=${toBase64Url(JSON.stringify(payload))}`;
}

export function readShareHash(hash) {
  const m = hash.match(/#share=([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try {
    return JSON.parse(fromBase64Url(m[1]));
  } catch {
    return null;
  }
}

function mergeCustom(state, recipes) {
  for (const r of recipes || []) {
    if (!state.customRecipes.some((c) => c.id === r.id)) state.customRecipes.push(r);
  }
}

/** Apply a shared week: replaces the plan for that week but keeps local ratings and ticks. */
export function applySharedWeek(state, payload, emptyWeekFn) {
  const incoming = payload.week;
  const existing = state.weeks[incoming.start] || emptyWeekFn(incoming.start, state.settings.members);
  existing.days = incoming.days.map((d) => {
    const local = existing.days.find((x) => x.date === d.date);
    return { ...d, ratings: local?.ratings || {} };
  });
  existing.extras = Array.from(new Set([...(existing.extras || []), ...(incoming.extras || [])]));
  state.weeks[incoming.start] = existing;
  mergeCustom(state, payload.customRecipes);
  return state;
}

/** Merge a full backup from the other phone. Ratings are combined per person. */
export function mergeBackup(state, backup) {
  for (const [start, week] of Object.entries(backup.weeks || {})) {
    const mine = state.weeks[start];
    if (!mine) {
      state.weeks[start] = week;
      continue;
    }
    for (const theirDay of week.days) {
      const myDay = mine.days.find((d) => d.date === theirDay.date);
      if (!myDay) continue;
      if (!myDay.recipeId && theirDay.recipeId) Object.assign(myDay, { ...theirDay, ratings: myDay.ratings });
      if (myDay.recipeId === theirDay.recipeId) myDay.ratings = { ...theirDay.ratings, ...myDay.ratings };
    }
  }
  mergeCustom(state, backup.customRecipes);
  const s = state.settings;
  const b = backup.settings || {};
  s.blocked = Array.from(new Set([...(s.blocked || []), ...(b.blocked || [])]));
  s.favourites = Array.from(new Set([...(s.favourites || []), ...(b.favourites || [])]));
  return state;
}
