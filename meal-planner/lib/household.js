// Household storage: one private JSON file per family in Vercel Blob,
// named after a hash of the family's sync code (the code itself is never stored).

import { createHash } from 'node:crypto';
import { get, list, put } from '@vercel/blob';

const CODE_RE = /^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/;
const PREFIX = 'households/';

export function validCode(code) {
  return typeof code === 'string' && CODE_RE.test(code);
}

export function pathForCode(code) {
  const id = createHash('sha256').update(`family-meal-planner:${code}`).digest('hex');
  return `${PREFIX}${id}.json`;
}

export async function loadDoc(pathname) {
  const result = await get(pathname, { access: 'private', useCache: false });
  if (!result) return {};
  const text = await new Response(result.stream).text();
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export async function saveDoc(pathname, doc) {
  await put(pathname, JSON.stringify(doc), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  });
}

export async function listHouseholds() {
  const out = [];
  let cursor;
  do {
    const page = await list({ prefix: PREFIX, cursor });
    out.push(...page.blobs.map((b) => b.pathname));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}

/** Basic shape check so a bad request can't corrupt a household's file. */
export function validDoc(doc) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return false;
  const maxU = Date.now() + 86400000;
  return Object.entries(doc).every(([k, rec]) =>
    typeof k === 'string' && k.length < 300 && rec && typeof rec === 'object'
    && typeof rec.u === 'number' && rec.u >= 0 && rec.u <= maxU && 'v' in rec);
}
