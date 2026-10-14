import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RECIPES } from '../public/js/recipes.js';
import {
  DEFAULT_SETTINGS, ageOn, buildProfile, collectHistory, dislikesIn, emptyWeek, generateWeek, pickRecipe,
  planningWeekStart, resolveMembers, seededRandom, shoppingDateFor, weekStartFor, dinnerBudget, weekCost,
} from '../public/js/planner.js';

const settings = structuredClone(DEFAULT_SETTINGS);
const byId = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
const emptyProfile = buildProfile([], byId);
const START = '2026-10-20'; // a Tuesday
const members = resolveMembers(settings.members, START);

function ctx(seed, extra = {}) {
  return { recipes: RECIPES, settings, members, profile: emptyProfile, rng: seededRandom(seed), freezer: {}, ...extra };
}

function plan(seed, opts = {}) {
  const week = opts.week || emptyWeek(START, settings.members);
  const s = opts.settings || settings;
  return generateWeek(week, ctx(seed, { settings: s, ...opts.ctx, profile: opts.profile || emptyProfile }));
}

test('recipe ids are unique and every recipe is well formed', () => {
  const ids = new Set();
  for (const r of RECIPES) {
    assert.ok(!ids.has(r.id), `duplicate ${r.id}`);
    ids.add(r.id);
    for (const k of ['name', 'cuisine', 'protein']) assert.ok(r[k], `${r.id} missing ${k}`);
    assert.ok(Array.isArray(r.ingredients) && Array.isArray(r.tags) && Array.isArray(r.method), r.id);
    if (r.leftoverOf) assert.ok(byId[r.leftoverOf], `${r.id} leftover of unknown ${r.leftoverOf}`);
  }
});

test('Ralph and Arlo: ages and portions come from their birthdays', () => {
  assert.equal(ageOn('2020-12-27', '2026-10-20'), 5);
  assert.equal(ageOn('2020-12-27', '2026-12-27'), 6);
  assert.equal(ageOn('2023-02-13', '2026-10-20'), 3);
  const [dad, mum, ralph, arlo] = members;
  assert.deepEqual([dad.portion, mum.portion, ralph.portion, arlo.portion], [1, 1, 0.6, 0.5]);
  assert.ok(ralph.child && arlo.child && !dad.child);
});

test('week runs Tuesday (delivery) to Monday; order by Sunday', () => {
  assert.equal(weekStartFor(new Date(2026, 9, 14), 2), '2026-10-13');
  assert.equal(shoppingDateFor('2026-10-20', settings), '2026-10-18');
  // Wednesday: still planning this week. Sunday (order day): next week.
  assert.equal(planningWeekStart(new Date(2026, 9, 14), settings), '2026-10-13');
  assert.equal(planningWeekStart(new Date(2026, 9, 18), settings), '2026-10-20');
  assert.equal(planningWeekStart(new Date(2026, 9, 19), settings), '2026-10-20');
});

test('a generated week fills 7 days with no repeats', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const ids = plan(seed).days.map((d) => d.recipeId);
    assert.ok(ids.every(Boolean), `seed ${seed} left a gap`);
    assert.equal(new Set(ids).size, 7, `seed ${seed} repeated a meal`);
  }
});

test('weekly mix: 2–3 chicken, a steak, a salmon and a treat on Friday', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const week = plan(seed, { settings: { ...settings, leftovers: false, budget: { max: 0 } } });
    const meals = week.days.map((d) => byId[d.recipeId]);
    const nonCheat = meals.filter((r) => !r.cheat);
    const chicken = nonCheat.filter((r) => r.protein === 'chicken').length;
    assert.ok(chicken >= 2 && chicken <= 3, `seed ${seed}: ${chicken} chicken`);
    assert.equal(nonCheat.filter((r) => r.protein === 'steak').length, 1);
    assert.equal(nonCheat.filter((r) => r.protein === 'salmon').length, 1);
    assert.equal(meals.filter((r) => r.cheat).length, 1);
    const friday = week.days.find((d) => new Date(`${d.date}T12:00`).getDay() === 5);
    assert.ok(byId[friday.recipeId].cheat, `seed ${seed}: treat not on Friday`);
  }
});

test('salmon is eaten in the first half of the week, while it is fresh', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const week = plan(seed);
    const i = week.days.findIndex((d) => byId[d.recipeId].protein === 'salmon');
    if (i >= 0) assert.ok(i <= 3, `seed ${seed}: salmon on day ${i}`);
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
  const week = emptyWeek(START, settings.members);
  week.days[3].eaters = [];
  assert.equal(plan(3, { week }).days[3].recipeId, null);
});

test('one-off nights with Dad and the boys favour kid-friendly meals', () => {
  const week = emptyWeek(START, settings.members);
  const friday = week.days[3];
  friday.eaters = ['dad', 'ralph', 'arlo'];
  friday.slot = 'any';
  let kidFriendly = 0;
  for (let seed = 1; seed <= 100; seed++) if (pickRecipe(week, friday, ctx(seed)).kid) kidFriendly++;
  assert.ok(kidFriendly >= 90, `only ${kidFriendly}/100 kid-friendly`);
});

test('soft dislikes: red onion dishes are less likely when the boys eat, but not banned', () => {
  const souvlaki = byId['chicken-souvlaki'];
  assert.deepEqual(dislikesIn(souvlaki, members).map((d) => d.member.id), ['ralph', 'arlo']);
  const count = (s) => {
    let n = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const week = emptyWeek(START, s.members);
      const day = week.days[1];
      day.slot = 'chicken';
      const ms = resolveMembers(s.members, START);
      const r = pickRecipe(week, day, { ...ctx(seed), settings: s, members: ms });
      if (r.ingredients.some((l) => l.includes('red onion'))) n++;
    }
    return n;
  };
  const without = count({ ...settings, members: settings.members.map((m) => ({ ...m, dislikes: [] })) });
  const withDislikes = count(settings);
  assert.ok(withDislikes < without, `${withDislikes} vs ${without}`);
  assert.ok(withDislikes > 0, 'should still come up sometimes');
});

test('learning: a meal everyone hated is avoided; a loved meal comes back', () => {
  const all = { dad: -2, mum: -2, ralph: -2, arlo: -2 };
  const days = {
    '2026-09-07': { date: '2026-09-07', recipeId: 'chicken-korma', eaters: Object.keys(all), ratings: all },
    '2026-09-08': { date: '2026-09-08', recipeId: 'chicken-chow-mein', eaters: Object.keys(all), ratings: { dad: 2, mum: 2, ralph: 2, arlo: 1 } },
  };
  const profile = buildProfile(collectHistory(days, '2026-10-14'), byId);
  let korma = 0;
  let loved = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const ids = plan(seed, { profile }).days.map((d) => d.recipeId);
    if (ids.includes('chicken-korma')) korma++;
    if (ids.includes('chicken-chow-mein')) loved++;
  }
  assert.ok(korma < 10, `korma picked ${korma}/200`);
  assert.ok(loved > 100, `chow mein picked ${loved}/200`);
});

test('learning: a dish the kids refused is avoided when they eat, not when only adults do', () => {
  const days = {
    '2026-09-07': { date: '2026-09-07', recipeId: 'prawn-linguine', eaters: ['dad', 'mum', 'ralph', 'arlo'], ratings: { dad: 2, mum: 2, ralph: -2, arlo: -2 } },
  };
  const profile = buildProfile(collectHistory(days, '2026-10-14'), byId);
  const count = (eaters) => {
    let n = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const week = emptyWeek(START, settings.members);
      const day = week.days[2];
      day.eaters = eaters;
      day.slot = 'any';
      if (pickRecipe(week, day, ctx(seed, { profile })).id === 'prawn-linguine') n++;
    }
    return n;
  };
  assert.ok(count(['dad', 'mum']) > count(['dad', 'mum', 'ralph', 'arlo']) * 2);
});

test('blocked meals and nut meals are never suggested', () => {
  const s = { ...structuredClone(settings), blocked: ['chicken-fajitas'], avoidNuts: true };
  for (let seed = 1; seed <= 50; seed++) {
    const ids = plan(seed, { settings: s }).days.map((d) => d.recipeId);
    assert.ok(!ids.includes('chicken-fajitas'));
    assert.ok(ids.every((id) => !byId[id].tags.includes('nuts')));
  }
});

test('leftovers: a Sunday roast is followed by leftover fried rice on Monday', () => {
  const week = emptyWeek(START, settings.members);
  const sunday = week.days[5];
  sunday.recipeId = 'roast-chicken';
  sunday.locked = true;
  let hits = 0;
  for (let seed = 1; seed <= 30; seed++) {
    if (plan(seed, { week }).days[6].recipeId === 'roast-chicken-fried-rice') hits++;
  }
  assert.ok(hits >= 10, `leftovers used ${hits}/30`);
  // ...and never offered without the roast the day before.
  for (let seed = 1; seed <= 30; seed++) {
    assert.ok(!plan(seed).days.some((d, i, all) => byId[d.recipeId].leftoverOf && all[i - 1]?.recipeId !== byId[d.recipeId].leftoverOf));
  }
});

test('freezer: a frozen meal is used on a weeknight and the oldest goes first', () => {
  const freezer = {
    'fz-a': { id: 'fz-a', recipeId: 'chilli-con-carne', madeOn: '2026-09-01' },
    'fz-b': { id: 'fz-b', recipeId: 'lasagne', madeOn: '2026-10-01' },
  };
  for (let seed = 1; seed <= 20; seed++) {
    const week = plan(seed, { ctx: { freezer } });
    const frozen = week.days.filter((d) => d.fromFreezer);
    assert.equal(frozen.length, 1, `seed ${seed}`);
    assert.equal(frozen[0].fromFreezer, 'fz-a');
    assert.equal(frozen[0].recipeId, 'chilli-con-carne');
    const dow = new Date(`${frozen[0].date}T12:00`).getDay();
    assert.ok(dow >= 1 && dow <= 4, `freezer night on ${dow}`);
  }
  // Already claimed elsewhere -> not used again.
  const week = plan(1, { ctx: { freezer: { 'fz-a': freezer['fz-a'] }, claimedFreezer: ['fz-a'] } });
  assert.ok(!week.days.some((d) => d.fromFreezer));
});

test('budget: a tight budget pushes the plan cheaper', () => {
  const tight = { ...settings, budget: { min: 60, max: 70, other: 35 } };
  const loose = { ...settings, budget: { max: 0 } };
  let tightTotal = 0;
  let looseTotal = 0;
  for (let seed = 1; seed <= 20; seed++) {
    tightTotal += weekCost(plan(seed, { settings: tight }), byId, { members, settings: tight }).dinners;
    looseTotal += weekCost(plan(seed, { settings: loose }), byId, { members, settings: loose }).dinners;
  }
  assert.ok(tightTotal < looseTotal, `${tightTotal} vs ${looseTotal}`);
});

test('default budget leaves a sensible amount for dinners', () => {
  const d = dinnerBudget(settings);
  assert.ok(d > 50 && d < 80, `dinner budget ${d}`);
  let total = 0;
  for (let seed = 1; seed <= 20; seed++) total += weekCost(plan(seed), byId, { members, settings }).total + settings.budget.other;
  const avg = total / 20;
  assert.ok(avg > 85 && avg < 130, `average weekly estimate £${avg.toFixed(0)}`);
});

test('red meat usually stays at three dinners or fewer', () => {
  let over = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const week = plan(seed);
    if (week.days.filter((d) => byId[d.recipeId].tags.includes('red-meat')).length > 3) over++;
  }
  assert.ok(over <= 10, `${over}/100 weeks had 4+ red meat dinners`);
});
