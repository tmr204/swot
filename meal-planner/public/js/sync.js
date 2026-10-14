// Sync between phones.
//
// The shared data is flattened into a map of small records:
//   { "day:2026-10-20": { v: {...}, u: 1739999999999 }, "rating:2026-10-20:ralph": { v: 2, u: … }, … }
// Each record carries the time it last changed (u). Merging two copies
// keeps the newer version of each record, so both phones can edit
// different things at once and nothing is lost. Deletions are kept as
// { v: null } so they sync too.
//
// Used by both the app and the server (api/sync.js).

const SHARED = ['settings', 'days', 'weekMeta', 'customRecipes', 'freezer', 'push'];

/** Turn the shared parts of the app state into flat key -> value pairs. */
export function flatten(state) {
  const out = {};
  if (state.settings) out.settings = state.settings;
  for (const [date, day] of Object.entries(state.days || {})) {
    const { ratings, ...rest } = day;
    out[`day:${date}`] = rest;
    for (const [member, value] of Object.entries(ratings || {})) {
      if (value != null) out[`rating:${date}:${member}`] = value;
    }
  }
  for (const [start, meta] of Object.entries(state.weekMeta || {})) {
    if (meta.extras?.length) out[`extras:${start}`] = meta.extras;
    for (const [k, v] of Object.entries(meta.checked || {})) if (v) out[`check:${start}:${k}`] = true;
    for (const [k, v] of Object.entries(meta.staplesNeeded || {})) if (v) out[`need:${start}:${k}`] = true;
  }
  for (const r of state.customRecipes || []) out[`recipe:${r.id}`] = r;
  for (const [id, item] of Object.entries(state.freezer || {})) if (item) out[`freezer:${id}`] = item;
  for (const [id, sub] of Object.entries(state.push || {})) if (sub) out[`push:${id}`] = sub;
  return out;
}

function split(key) {
  const i = key.indexOf(':');
  return i < 0 ? [key, ''] : [key.slice(0, i), key.slice(i + 1)];
}

/** Rebuild the shared parts of the state from a synced doc. */
export function unflatten(doc) {
  const state = { settings: null, days: {}, weekMeta: {}, customRecipes: [], freezer: {}, push: {} };
  const meta = (start) => state.weekMeta[start] || (state.weekMeta[start] = { extras: [], checked: {}, staplesNeeded: {} });
  const ratings = [];
  for (const [key, rec] of Object.entries(doc)) {
    if (!rec || rec.v == null) continue;
    const v = rec.v;
    const [type, rest] = split(key);
    if (type === 'settings') state.settings = v;
    else if (type === 'day') state.days[rest] = { ...v, ratings: {} };
    else if (type === 'rating') ratings.push([rest, v]);
    else if (type === 'extras') meta(rest).extras = v;
    else if (type === 'check' || type === 'need') {
      const [start, item] = split(rest);
      meta(start)[type === 'check' ? 'checked' : 'staplesNeeded'][item] = true;
    } else if (type === 'recipe') state.customRecipes.push(v);
    else if (type === 'freezer') state.freezer[rest] = v;
    else if (type === 'push') state.push[rest] = v;
  }
  for (const [rest, value] of ratings) {
    const [date, member] = split(rest);
    if (state.days[date]) state.days[date].ratings[member] = value;
  }
  return state;
}

function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Stamp local changes: anything that differs from the last synced doc gets
 * time `now`; anything that disappeared becomes a deletion.
 */
export function stamp(flat, previousDoc, now) {
  const doc = {};
  for (const [key, value] of Object.entries(flat)) {
    const prev = previousDoc[key];
    doc[key] = prev && same(prev.v, value) ? prev : { v: value, u: now };
  }
  for (const [key, prev] of Object.entries(previousDoc)) {
    if (key in doc) continue;
    doc[key] = prev.v == null ? prev : { v: null, u: now };
  }
  return doc;
}

/** Newest record wins; ties are broken consistently so both sides agree. */
export function mergeDocs(a, b) {
  const out = { ...a };
  for (const [key, rec] of Object.entries(b)) {
    const mine = out[key];
    if (!mine || rec.u > mine.u || (rec.u === mine.u && JSON.stringify(rec.v) > JSON.stringify(mine.v))) {
      out[key] = rec;
    }
  }
  return out;
}

/** Drop deletion markers older than `maxAgeMs` so the doc doesn't grow forever. */
export function compact(doc, now, maxAgeMs = 90 * 86400000) {
  const out = {};
  for (const [key, rec] of Object.entries(doc)) {
    if (rec.v == null && now - rec.u > maxAgeMs) continue;
    out[key] = rec;
  }
  return out;
}

export function docEquals(a, b) {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => b[k] && a[k].u === b[k].u && same(a[k].v, b[k].v));
}

export { SHARED };
