// Persistence on this phone, plus syncing with the other phone via /api/sync.

import { defaultState, migrate, withDefaultSettings } from './model.js';
import { docEquals, flatten, mergeDocs, stamp, unflatten } from './sync.js';

const KEY = 'family-meal-planner.v1';

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? migrate(JSON.parse(raw)) : defaultState();
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

// ------------------------------------------------------------- sync codes

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function newSyncCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

export function normaliseCode(input) {
  const c = String(input || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  return c.length === 12 ? `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8, 12)}` : null;
}

export function inviteLink(baseUrl, code) {
  return `${baseUrl}#join=${code}`;
}

export function readJoinHash(hash) {
  const m = hash.match(/#join=([A-Za-z0-9-]+)/);
  return m ? normaliseCode(m[1]) : null;
}

/** Joining an existing family: the other phone's data wins any clash. */
export function joinFamily(state, code) {
  state.device = { ...state.device, syncCode: code };
  state.syncDoc = stamp(flatten(state), {}, 0);
}

export function startFamily(state) {
  const code = newSyncCode();
  state.device = { ...state.device, syncCode: code };
  state.syncDoc = {};
  return code;
}

export function leaveFamily(state) {
  state.device = { ...state.device, syncCode: null };
  state.syncDoc = {};
}

function applyDoc(state, doc) {
  const shared = unflatten(doc);
  state.settings = withDefaultSettings(shared.settings || state.settings);
  state.days = shared.days;
  state.weekMeta = shared.weekMeta;
  state.customRecipes = shared.customRecipes;
  state.freezer = shared.freezer;
  state.push = shared.push;
  state.syncDoc = doc;
}

/**
 * Push local changes and pull the other phone's.
 * Returns { changed } — true if anything arrived from the other phone.
 */
export async function syncNow(state, fetchImpl = fetch) {
  const code = state.device?.syncCode;
  if (!code) return { changed: false, skipped: true };
  const sent = stamp(flatten(state), state.syncDoc || {}, Date.now());
  const res = await fetchImpl('/api/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, doc: sent }),
  });
  if (!res.ok) throw new Error(`Sync failed (${res.status})`);
  const { doc: merged } = await res.json();
  // Anything edited while the request was in flight is kept and goes up next time.
  const latest = stamp(flatten(state), sent, Date.now());
  const final = mergeDocs(merged, latest);
  const changed = !docEquals(merged, sent);
  applyDoc(state, final);
  state.device.lastSync = Date.now();
  return { changed, pending: !docEquals(final, merged) };
}
