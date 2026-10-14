// App state shape and week helpers. Shared by the app and the server.
//
// state = {
//   settings,                        synced
//   days:      { 'YYYY-MM-DD': day }, synced (only days with something in them)
//   weekMeta:  { weekStart: { extras, checked, staplesNeeded } }, synced
//   customRecipes: [],               synced
//   freezer:   { id: { id, recipeId, madeOn, portions, note } }, synced
//   push:      { id: subscription },  synced (so the server can notify both phones)
//   device:    { syncCode, pushId, lastNotified, lastSync }, this phone only
//   syncDoc:   last synced copy, this phone only
// }

import { DEFAULT_SETTINGS, addDays, blankDay } from './planner.js';

export function defaultState() {
  return {
    version: 2,
    settings: structuredClone(DEFAULT_SETTINGS),
    days: {},
    weekMeta: {},
    customRecipes: [],
    freezer: {},
    push: {},
    device: {},
    syncDoc: {},
  };
}

export function withDefaultSettings(settings) {
  const base = structuredClone(DEFAULT_SETTINGS);
  const s = settings || {};
  return {
    ...base,
    ...s,
    mix: { ...base.mix, ...(s.mix || {}) },
    budget: { ...base.budget, ...(s.budget || {}) },
    members: (s.members || base.members).map((m) => ({ dislikes: [], portion: 'auto', ...m })),
  };
}

/** Upgrade the first version (weeks stored as blocks of 7). */
export function migrate(raw) {
  const state = { ...defaultState(), ...raw };
  if (raw.weeks) {
    for (const week of Object.values(raw.weeks)) {
      for (const day of week.days || []) if (dayHasContent(day, null)) state.days[day.date] = day;
      state.weekMeta[week.start] = { extras: week.extras || [], checked: week.checked || {}, staplesNeeded: week.staplesNeeded || {} };
    }
    delete state.weeks;
  }
  if (raw.lastNotified) state.device = { ...state.device, lastNotified: raw.lastNotified };
  delete state.lastNotified;
  state.settings = withDefaultSettings(state.settings);
  state.version = 2;
  return state;
}

export function dayHasContent(day, memberIds) {
  if (!day) return false;
  const allEating = !memberIds || (day.eaters.length === memberIds.length && memberIds.every((id) => day.eaters.includes(id)));
  return !!(day.recipeId || day.fromFreezer || day.locked || day.double || !allEating
    || Object.keys(day.ratings || {}).length);
}

/** A 7-day view starting at `start`. Days are copies; save with putWeek. */
export function weekView(state, start) {
  const members = state.settings.members;
  const meta = state.weekMeta[start] || {};
  return {
    start,
    days: Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i);
      const day = state.days[date];
      return day ? structuredClone(day) : blankDay(date, members);
    }),
    extras: [...(meta.extras || [])],
    checked: { ...(meta.checked || {}) },
    staplesNeeded: { ...(meta.staplesNeeded || {}) },
  };
}

export function putWeek(state, week) {
  const ids = state.settings.members.map((m) => m.id);
  for (const day of week.days) {
    if (dayHasContent(day, ids)) state.days[day.date] = day;
    else delete state.days[day.date];
  }
  const meta = { extras: week.extras || [], checked: week.checked || {}, staplesNeeded: week.staplesNeeded || {} };
  if (meta.extras.length || Object.keys(meta.checked).length || Object.keys(meta.staplesNeeded).length) {
    state.weekMeta[week.start] = meta;
  } else {
    delete state.weekMeta[week.start];
  }
}

/** Freezer items already claimed by a planned day outside this week. */
export function claimedFreezerOutside(state, week) {
  const dates = new Set(week.days.map((d) => d.date));
  return Object.values(state.days)
    .filter((d) => d.fromFreezer && !dates.has(d.date))
    .map((d) => d.fromFreezer);
}

/**
 * Freezer contents as of `today`: things cooked double (once the day has
 * been) plus anything added by hand, minus what's been eaten.
 */
export function freezerContents(state, today) {
  const eaten = new Set(Object.values(state.days).filter((d) => d.fromFreezer && d.date <= today).map((d) => d.fromFreezer));
  const plannedFor = {};
  for (const d of Object.values(state.days)) if (d.fromFreezer && d.date > today) plannedFor[d.fromFreezer] = d.date;
  return Object.values(state.freezer)
    .filter((f) => f && !eaten.has(f.id))
    .map((f) => ({ ...f, ready: f.madeOn <= today, plannedFor: plannedFor[f.id] || null }))
    .sort((a, b) => (a.madeOn < b.madeOn ? -1 : 1));
}
