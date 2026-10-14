import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compact, docEquals, flatten, mergeDocs, stamp, unflatten } from '../public/js/sync.js';
import { defaultState, migrate, putWeek, weekView, freezerContents } from '../public/js/model.js';
import { joinFamily, normaliseCode, readJoinHash, syncNow } from '../public/js/store.js';

function phone() {
  const s = defaultState();
  s.device.syncCode = 'ABCD-EFGH-JKMN';
  return s;
}

// A fake /api/sync that behaves like the real one.
function fakeServer() {
  let doc = {};
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    doc = compact(mergeDocs(doc, body.doc), Date.now());
    return { ok: true, json: async () => ({ doc: structuredClone(doc) }) };
  };
  return { fetchImpl, get doc() { return doc; } };
}

test('flatten / unflatten round-trips the shared state', () => {
  const s = defaultState();
  const week = weekView(s, '2026-10-20');
  week.days[0].recipeId = 'chilli-con-carne';
  week.days[0].ratings = { ralph: 2 };
  week.days[1].eaters = ['dad', 'ralph', 'arlo'];
  week.extras = ['Nappies'];
  week.checked = { 'onion|': true };
  putWeek(s, week);
  s.freezer['fz-1'] = { id: 'fz-1', recipeId: 'lasagne', madeOn: '2026-10-01' };
  s.customRecipes.push({ id: 'custom-pie', name: 'Pie', ingredients: [], tags: [] });
  const back = unflatten(stamp(flatten(s), {}, 1));
  for (const k of ['days', 'weekMeta', 'freezer', 'customRecipes', 'settings']) assert.deepEqual(back[k], s[k], k);
  assert.equal(Object.keys(s.days).length, 2, 'blank days are not stored');
});

test('newest change wins per record, so both phones can edit at once', () => {
  const base = stamp({ a: 1, b: 1 }, {}, 100);
  const phoneA = stamp({ a: 2, b: 1 }, base, 200);   // A edits a
  const phoneB = stamp({ a: 1, b: 3 }, base, 300);   // B edits b
  const merged = mergeDocs(mergeDocs(base, phoneA), phoneB);
  assert.deepEqual(Object.fromEntries(Object.entries(merged).map(([k, r]) => [k, r.v])), { a: 2, b: 3 });
  assert.ok(docEquals(mergeDocs(phoneA, phoneB), mergeDocs(phoneB, phoneA)), 'merge order does not matter');
});

test('deletions sync, and old deletion markers are tidied away', () => {
  const base = stamp({ a: 1, b: 1 }, {}, 100);
  const deleted = stamp({ a: 1 }, base, 200);
  assert.equal(deleted.b.v, null);
  assert.equal(unflatten(mergeDocs(base, deleted)).settings, null);
  assert.ok(!('b' in compact(deleted, 200 + 91 * 86400000)));
});

test('two phones sync plans, ratings, ticks and the freezer', async () => {
  const server = fakeServer();
  const dad = phone();
  const mum = phone();

  // Dad plans Tuesday; Mum rates last week's meal and ticks an item.
  const w = weekView(dad, '2026-10-20');
  w.days[0].recipeId = 'chicken-fajitas';
  putWeek(dad, w);
  dad.freezer['fz-1'] = { id: 'fz-1', recipeId: 'spag-bol', madeOn: '2026-10-10' };
  const m = weekView(mum, '2026-10-13');
  m.days[0].recipeId = 'chicken-korma';
  m.days[0].ratings = { arlo: -2 };
  m.checked = { 'onion|': true };
  putWeek(mum, m);

  await syncNow(dad, server.fetchImpl);
  await syncNow(mum, server.fetchImpl);
  await syncNow(dad, server.fetchImpl);

  for (const p of [dad, mum]) {
    assert.equal(p.days['2026-10-20'].recipeId, 'chicken-fajitas');
    assert.equal(p.days['2026-10-13'].ratings.arlo, -2);
    assert.equal(p.weekMeta['2026-10-13'].checked['onion|'], true);
    assert.equal(p.freezer['fz-1'].recipeId, 'spag-bol');
  }

  // Mum clears a day; it clears on Dad's phone too.
  const m2 = weekView(mum, '2026-10-20');
  m2.days[0].recipeId = null;
  putWeek(mum, m2);
  await syncNow(mum, server.fetchImpl);
  await syncNow(dad, server.fetchImpl);
  assert.equal(dad.days['2026-10-20'], undefined);
});

test('a new phone joining takes the family settings rather than its defaults', async () => {
  const server = fakeServer();
  const dad = phone();
  dad.settings.budget.max = 110;
  dad.settings.members[2].dislikes = ['red onion', 'mushrooms'];
  await syncNow(dad, server.fetchImpl);

  const mum = defaultState();
  joinFamily(mum, 'ABCD-EFGH-JKMN');
  await syncNow(mum, server.fetchImpl);
  assert.equal(mum.settings.budget.max, 110);
  assert.deepEqual(mum.settings.members[2].dislikes, ['red onion', 'mushrooms']);
});

test('sync codes and invite links', () => {
  assert.equal(normaliseCode('abcd efgh jkmn'), 'ABCD-EFGH-JKMN');
  assert.equal(normaliseCode('short'), null);
  assert.equal(readJoinHash('#join=ABCD-EFGH-JKMN'), 'ABCD-EFGH-JKMN');
});

test('first-version data is migrated', () => {
  const v1 = {
    settings: { members: [{ id: 'dad', name: 'Dad', portion: 1, child: false }], mix: { chicken: 3 } },
    weeks: { '2026-10-11': { start: '2026-10-11', days: [{ date: '2026-10-11', recipeId: 'spag-bol', eaters: ['dad'], ratings: {} }], extras: ['Nappies'], checked: {} } },
    customRecipes: [],
    lastNotified: '2026-10-10',
  };
  const s = migrate(v1);
  assert.equal(s.days['2026-10-11'].recipeId, 'spag-bol');
  assert.deepEqual(s.weekMeta['2026-10-11'].extras, ['Nappies']);
  assert.equal(s.settings.mix.chicken, 3);
  assert.equal(s.settings.mix.freezer, 1);
  assert.equal(s.device.lastNotified, '2026-10-10');
});

test('freezer contents: eaten items disappear, planned ones are marked', () => {
  const s = defaultState();
  s.freezer = {
    a: { id: 'a', recipeId: 'spag-bol', madeOn: '2026-09-01' },
    b: { id: 'b', recipeId: 'lasagne', madeOn: '2026-09-02' },
    c: { id: 'c', recipeId: 'chilli-con-carne', madeOn: '2026-10-20' },
  };
  s.days['2026-10-01'] = { date: '2026-10-01', recipeId: 'spag-bol', fromFreezer: 'a', eaters: ['dad'], ratings: {} };
  s.days['2026-10-16'] = { date: '2026-10-16', recipeId: 'lasagne', fromFreezer: 'b', eaters: ['dad'], ratings: {} };
  const items = freezerContents(s, '2026-10-14');
  assert.deepEqual(items.map((i) => i.id), ['b', 'c']);
  assert.equal(items[0].plannedFor, '2026-10-16');
  assert.equal(items[1].ready, false);
});
