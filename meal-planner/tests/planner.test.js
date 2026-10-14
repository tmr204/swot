import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RECIPES } from '../js/recipes.js';
import {
  DEFAULT_SETTINGS, buildProfile, collectHistory, emptyWeek, generateWeek, pickRecipe, seededRandom, weekStartFor,
} from '../js/planner.js';

const settings = structuredClone(DEFAULT_SETTINGS);
const byId = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
const emptyProfile = buildProfile([], byId);

function plan(seed, opts = {}) {
  const week = opts.week || emptyWeek('2026-10-18', settings.members);
  return generateWeek(week, { recipes: RECIPES, settings: opts.settings || settings, profile: opts.profile || emptyProfile, rng: seededRandom(seed) });
}

test('recipe ids are unique and every recipe is well formed', () => {
  const ids = new Set();
  for (const r of RECIPES) {
    assert.ok(!ids.has(r.id), `duplicate ${r.id}`);
    ids.add(r.id);
    for (const k of ['name', 'cuisine', 'protein']) assert.ok(r[k], `${r.id} missing ${k}`);
    assert.ok(Array.isArray(r.ingredients) && Array.isArray(r.tags) && Array.isArray(r.method), r.id);
  }
});

test('a generated week fills 7 days with no repeats', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const week = plan(seed);
    const ids = week.days.map((d) => d.recipeId);
    assert.ok(ids.every(Boolean), `seed ${seed} left a gap`);
    assert.equal(new Set(ids).size, 7, `seed ${seed} repeated a meal`);
  }
});

test('weekly mix: 2–3 chicken, a steak, a salmon and a treat on Friday', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const week = plan(seed);
    const meals = week.days.map((d) => byId[d.recipeId]);
    const nonCheat = meals.filter((r) => !r.cheat);
    const chicken = nonCheat.filter((r) => r.protein === 'chicken').length;
    assert.ok(chicken >= 2 && chicken <= 3, `seed ${seed}: ${chicken} chicken`);
    assert.equal(nonCheat.filter((r) => r.protein === 'steak').length, 1);
    assert.equal(nonCheat.filter((r) => r.protein === 'salmon').length, 1);
    assert.equal(meals.filter((r) => r.cheat).length, 1);
    const friday = week.days.find((d) => new Date(d.date).getDay() === 5);
    assert.ok(byId[friday.recipeId].cheat, `seed ${seed}: treat not on Friday`);
  }
});

test('locked days survive re-planning', () => {
  const first = plan(7);
  first.days[2].locked = true;
  const locked = first.days[2].recipeId;
  const again = plan(99, { week: first });
  assert.equal(again.days[2].recipeId, locked);
  assert.ok(again.days.filter((d, i) => i !== 2).every((d) => d.recipeId !== locked));
});

test('a day with nobody home gets no meal', () => {
  const week = emptyWeek('2026-10-18', settings.members);
  week.days[3].eaters = [];
  const out = plan(3, { week });
  assert.equal(out.days[3].recipeId, null);
});

test('one-off nights with Dad and the boys favour quick, kid-friendly meals', () => {
  const week = emptyWeek('2026-10-18', settings.members);
  const friday = week.days[5];
  friday.eaters = ['dad', 'boy1', 'boy2'];
  friday.slot = 'any';
  let kidFriendly = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const r = pickRecipe(week, friday, { recipes: RECIPES, settings, profile: emptyProfile, rng: seededRandom(seed) });
    if (r.kid) kidFriendly++;
  }
  assert.ok(kidFriendly >= 90, `only ${kidFriendly}/100 kid-friendly`);
});

test('learning: a meal everyone hated is avoided; a loved meal comes back', () => {
  const weeks = {
    '2026-09-06': {
      start: '2026-09-06',
      days: [
        { date: '2026-09-07', recipeId: 'chicken-korma', eaters: ['dad', 'mum', 'boy1', 'boy2'], ratings: { dad: -2, mum: -2, boy1: -2, boy2: -2 } },
        { date: '2026-09-08', recipeId: 'chicken-souvlaki', eaters: ['dad', 'mum', 'boy1', 'boy2'], ratings: { dad: 2, mum: 2, boy1: 2, boy2: 1 } },
      ],
    },
  };
  const profile = buildProfile(collectHistory(weeks, '2026-10-14'), byId);
  let korma = 0;
  let souvlaki = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const week = plan(seed, { profile });
    const ids = week.days.map((d) => d.recipeId);
    if (ids.includes('chicken-korma')) korma++;
    if (ids.includes('chicken-souvlaki')) souvlaki++;
  }
  assert.ok(korma < 10, `korma picked ${korma}/200`);
  assert.ok(souvlaki > 100, `souvlaki picked ${souvlaki}/200`);
});

test('learning: a dish the kids refused is avoided when they eat, not when only adults do', () => {
  const weeks = {
    w: {
      start: '2026-09-06',
      days: [{ date: '2026-09-07', recipeId: 'prawn-linguine', eaters: ['dad', 'mum', 'boy1', 'boy2'], ratings: { dad: 2, mum: 2, boy1: -2, boy2: -2 } }],
    },
  };
  const profile = buildProfile(collectHistory(weeks, '2026-10-14'), byId);
  const count = (eaters) => {
    let n = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const week = emptyWeek('2026-10-18', settings.members);
      const day = week.days[2];
      day.eaters = eaters;
      day.slot = 'any';
      if (pickRecipe(week, day, { recipes: RECIPES, settings, profile, rng: seededRandom(seed) }).id === 'prawn-linguine') n++;
    }
    return n;
  };
  assert.ok(count(['dad', 'mum']) > count(['dad', 'mum', 'boy1', 'boy2']) * 2);
});

test('blocked meals and nut meals are never suggested', () => {
  const s = { ...structuredClone(settings), blocked: ['chicken-fajitas'], avoidNuts: true };
  for (let seed = 1; seed <= 50; seed++) {
    const ids = plan(seed, { settings: s }).days.map((d) => d.recipeId);
    assert.ok(!ids.includes('chicken-fajitas'));
    assert.ok(ids.every((id) => !byId[id].tags.includes('nuts')));
  }
});

test('weekStartFor finds the previous Sunday', () => {
  assert.equal(weekStartFor(new Date(2026, 9, 14), 0), '2026-10-11');
  assert.equal(weekStartFor(new Date(2026, 9, 18), 0), '2026-10-18');
  assert.equal(weekStartFor(new Date(2026, 9, 14), 1), '2026-10-12');
});
