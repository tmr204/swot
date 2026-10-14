// Planning logic: weekly mix, learning from ratings, and picking meals.
// Pure functions only (no DOM, no storage) so it runs in Node too — the
// server uses it for the shopping-day notification.

import { buildShoppingList, recipeCost } from './shopping.js';
import { regularCost } from './prices.js';

export const RATINGS = [
  { value: 2, emoji: '😍', label: 'Loved it' },
  { value: 1, emoji: '👍', label: 'Liked it' },
  { value: 0, emoji: '😐', label: 'Meh' },
  { value: -2, emoji: '👎', label: 'Not again' },
];

export const DEFAULT_SETTINGS = {
  members: [
    { id: 'dad', name: 'Dad', portion: 'auto', dislikes: [] },
    { id: 'mum', name: 'Mum', portion: 'auto', dislikes: [] },
    { id: 'ralph', name: 'Ralph', dob: '2020-12-27', portion: 'auto', dislikes: ['red onion'] },
    { id: 'arlo', name: 'Arlo', dob: '2023-02-13', portion: 'auto', dislikes: ['red onion'] },
  ],
  // Dinners per week on average. 0.5 means "every other week".
  mix: { chicken: 2.5, steak: 1, salmon: 1, mince: 0.5, veggie: 0, cheat: 1, newMeals: 1, freezer: 1 },
  weekStart: 2,      // Tuesday — the shop arrives Tuesday morning
  shoppingDay: 0,    // Sunday — order deadline
  cheatDay: 5,       // Friday
  weeknightMaxTime: 40,
  avoidNuts: false,
  leftovers: true,
  budget: { min: 100, max: 120, other: 35 },
  blocked: [],
  favourites: [],
  regulars: ['Milk x2', 'Bread', 'Bananas', 'Apples', 'Kids\' yoghurts', 'Breakfast cereal'],
};

// Quota slots map to these proteins. "any" covers everything else so the week
// doesn't drift into chicken every night.
const SLOT_PROTEINS = {
  chicken: ['chicken'],
  steak: ['steak'],
  salmon: ['salmon'],
  mince: ['mince'],
  veggie: ['veggie'],
  any: ['pork', 'lamb', 'fish', 'prawns', 'veggie', 'beef'],
};
const SLOT_PRIORITY = ['cheat', 'chicken', 'salmon', 'steak', 'mince', 'veggie', 'any'];

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ------------------------------------------------------------------ dates

export function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISODate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso, n) {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function daysBetween(a, b) {
  return Math.round((parseISODate(b) - parseISODate(a)) / 86400000);
}

export function weekStartFor(date, weekStart) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = (d.getDay() - weekStart + 7) % 7;
  d.setDate(d.getDate() - diff);
  return toISODate(d);
}

/** From the shopping day onwards, the week being planned is next week. */
export function planningWeekStart(today, settings) {
  const thisWeek = weekStartFor(today, settings.weekStart);
  const idxToday = (today.getDay() - settings.weekStart + 7) % 7;
  const idxShop = (settings.shoppingDay - settings.weekStart + 7) % 7;
  return idxToday >= idxShop && idxShop >= 4 ? addDays(thisWeek, 7) : thisWeek;
}

/** The shopping day that comes before a week starts. */
export function shoppingDateFor(weekStart, settings) {
  const startDow = parseISODate(weekStart).getDay();
  const back = (startDow - settings.shoppingDay + 7) % 7 || 7;
  return addDays(weekStart, -back);
}

// ---------------------------------------------------------------- members

export function ageOn(dob, onIso) {
  if (!dob) return null;
  const [by, bm, bd] = dob.split('-').map(Number);
  const [y, m, d] = onIso.split('-').map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

export function portionForAge(age) {
  if (age == null) return 1;
  if (age < 2) return 0.35;
  if (age < 5) return 0.5;
  if (age < 8) return 0.6;
  if (age < 11) return 0.75;
  if (age < 14) return 0.9;
  return 1;
}

/** Members with age, portion and child flag worked out for a given date. */
export function resolveMembers(members, onIso) {
  return members.map((m) => {
    const age = ageOn(m.dob, onIso);
    const portion = typeof m.portion === 'number' ? m.portion : portionForAge(age);
    const child = age != null ? age < 12 : !!m.child;
    return { ...m, age, portion, child, dislikes: m.dislikes || [] };
  });
}

export function displayName(m) {
  return m.age != null && m.age < 18 ? `${m.name} (${m.age})` : m.name;
}

/** Which eaters aren't keen on something in this recipe. */
export function dislikesIn(recipe, eaters) {
  const text = [...(recipe.ingredients || []), recipe.name].join(' ').toLowerCase();
  const out = [];
  for (const m of eaters) {
    for (const term of m.dislikes || []) {
      if (term && text.includes(term.toLowerCase())) out.push({ member: m, term });
    }
  }
  return out;
}

// ------------------------------------------------------------------ weeks

export function blankDay(date, members) {
  return { date, recipeId: null, slot: null, explore: false, locked: false, eaters: members.map((m) => m.id), ratings: {} };
}

export function emptyWeek(start, members) {
  return {
    start,
    days: Array.from({ length: 7 }, (_, i) => blankDay(addDays(start, i), members)),
    extras: [],
    checked: {},
    staplesNeeded: {},
  };
}

// ------------------------------------------------------------------ random

export function seededRandom(seed) {
  let a = seed >>> 0;
  return function mulberry32() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function weightedPick(items, weights, rng) {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// ---------------------------------------------------------------- learning

/** Every planned day up to `today` counts as cooked. `days` is { date: day }. */
export function collectHistory(days, today) {
  return Object.values(days)
    .filter((d) => d.recipeId && d.date <= today)
    .map((d) => ({ date: d.date, recipeId: d.recipeId, ratings: d.ratings || {}, eaters: d.eaters }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

function bump(map, key, value) {
  const s = map[key] || (map[key] = { n: 0, sum: 0 });
  s.n += 1;
  s.sum += value;
}

export function buildProfile(history, recipesById) {
  const profile = { recipes: {}, cuisines: {}, proteins: {}, ratedCount: 0, triedCuisines: new Set() };
  for (const h of history) {
    const recipe = recipesById[h.recipeId];
    if (!recipe) continue;
    const r = profile.recipes[h.recipeId] || (profile.recipes[h.recipeId] = { byMember: {}, n: 0, sum: 0, lastDate: null, cooked: 0 });
    r.cooked += 1;
    if (!r.lastDate || h.date > r.lastDate) r.lastDate = h.date;
    profile.triedCuisines.add(recipe.cuisine);
    const values = Object.entries(h.ratings || {}).filter(([, v]) => typeof v === 'number');
    if (values.length) profile.ratedCount += 1;
    for (const [member, value] of values) {
      bump(r.byMember, member, value);
      r.n += 1;
      r.sum += value;
      bump(profile.cuisines, recipe.cuisine, value);
      bump(profile.proteins, recipe.protein, value);
    }
  }
  return profile;
}

// Shrink towards zero until we have a few data points.
function shrunk(stat, k = 3) {
  return stat ? stat.sum / (stat.n + k) : 0;
}

export function scoreRecipe(recipe, ctx) {
  const { profile, eaters, date, settings, explore, picked } = ctx;
  const reasons = [];
  let score = 0;

  const prior = 0.5 * shrunk(profile.cuisines[recipe.cuisine]) + 0.5 * shrunk(profile.proteins[recipe.protein]);
  const stats = profile.recipes[recipe.id];
  let memberAvgs = [];
  if (stats) {
    memberAvgs = eaters
      .map((m) => stats.byMember[m.id])
      .filter(Boolean)
      .map((s) => s.sum / s.n);
  }
  if (memberAvgs.length) {
    const avg = memberAvgs.reduce((a, b) => a + b, 0) / memberAvgs.length;
    const w = stats.n / (stats.n + 1);
    score += 1.2 * (w * avg + (1 - w) * prior);
    if (avg >= 1.5) reasons.push('A family favourite');
    if (memberAvgs.some((a) => a <= -1.5)) score -= 1.5;
  } else {
    score += 1.2 * prior;
    if (prior > 0.4) reasons.push(`You tend to like ${recipe.cuisine} food`);
  }

  if (settings.favourites?.includes(recipe.id)) score += 0.8;

  const untried = !stats;
  if (explore) {
    if (untried) {
      score += 2.5;
      reasons.push('Something new to try');
      if (!profile.triedCuisines.has(recipe.cuisine)) score += 0.5;
    }
  } else if (untried) {
    score -= 0.3 * Math.min(1, profile.ratedCount / 10);
  }

  if (stats?.lastDate) {
    const ago = daysBetween(stats.lastDate, date);
    if (ago >= 0) {
      if (ago < 7) score -= 4;
      else if (ago < 14) score -= 2;
      else if (ago < 21) score -= 0.8;
      else if (ago < 35) score -= 0.3;
    }
  }

  const kids = eaters.filter((m) => m.child).length;
  const adults = eaters.length - kids;
  if (kids > 0) {
    score += recipe.kid ? 0.4 : -0.8;
    if (recipe.tags.includes('spicy')) score -= 0.3;
    if (adults === 1 && recipe.time <= 30) {
      score += 0.4;
      reasons.push('Quick for a solo night with the boys');
    }
  } else if (adults > 0 && !recipe.kid) {
    score += 0.3;
    reasons.push('Grown-ups only night');
  }

  // Soft dislikes: steer away, but don't rule out.
  score -= 0.35 * dislikesIn(recipe, eaters).length;

  const dow = parseISODate(date).getDay();
  const weeknight = dow >= 1 && dow <= 5;
  if (weeknight && recipe.time > settings.weeknightMaxTime) {
    score -= 1.2 * Math.min(2, (recipe.time - settings.weeknightMaxTime) / 20);
  }
  if (dow === 0 && recipe.tags.includes('roast')) {
    score += 0.8;
    reasons.push('Sunday roast');
  }

  for (const p of picked || []) {
    const pr = p.recipe;
    if (!pr || pr.cuisine !== recipe.cuisine || pr.cheat) continue;
    score -= Math.abs(daysBetween(p.date, date)) === 1 ? 1.2 : 0.5;
  }
  // A treat shouldn't pile on top of a protein the week already has plenty of.
  if (recipe.cheat && recipe.protein !== 'mixed') {
    const same = (picked || []).filter((p) => p.recipe?.protein === recipe.protein).length;
    if (same >= 2) score -= 1;
  }

  // Keep red meat to about three dinners a week.
  if (recipe.tags.includes('red-meat')) {
    const red = (picked || []).filter((p) => p.recipe?.tags.includes('red-meat')).length;
    if (red >= 2) score -= 0.8 * (red - 1);
  }

  // Gentle nudge towards veg-heavy dishes.
  score += 0.15 * (recipe.veg || 0);

  return { score, reasons };
}

// ------------------------------------------------------------- generation

function quotaCount(value, rng) {
  const whole = Math.floor(value);
  return whole + (rng() < value - whole ? 1 : 0);
}

export function slotForRecipe(recipe) {
  if (recipe.cheat) return 'cheat';
  for (const slot of ['chicken', 'steak', 'salmon', 'mince']) {
    if (SLOT_PROTEINS[slot].includes(recipe.protein)) return slot;
  }
  return 'any';
}

function buildSlots(nDays, lockedSlots, settings, rng) {
  const mix = settings.mix;
  const counts = {
    cheat: quotaCount(mix.cheat, rng),
    chicken: quotaCount(mix.chicken, rng),
    steak: quotaCount(mix.steak, rng),
    salmon: quotaCount(mix.salmon, rng),
    mince: quotaCount(mix.mince, rng),
    veggie: quotaCount(mix.veggie, rng),
  };
  for (const s of lockedSlots) if (counts[s] > 0) counts[s] -= 1;

  const slots = [];
  for (const name of SLOT_PRIORITY) {
    for (let i = 0; i < (counts[name] || 0); i++) slots.push(name);
  }
  // Too many quota slots for the days available: drop lowest priority first.
  while (slots.length > nDays) slots.pop();
  while (slots.length < nDays) slots.push('any');
  return slots;
}

// Lower is better: avoid the same slot two nights running, and eat fresh
// fish and steak early in the week while they're fresh from the delivery.
function arrangementPenalty(order) {
  let p = 0;
  for (let i = 0; i < order.length; i++) {
    if (i > 0 && order[i] === order[i - 1] && order[i] !== 'any') p += 1;
    if (order[i] === 'salmon' && i >= 4) p += 1;
    if (order[i] === 'steak' && i >= 5) p += 0.5;
  }
  return p;
}

/** Freezer items free to use on `date` (made before it, not claimed by another day). */
export function freezerAvailable(freezer, claimedIds, date) {
  return Object.values(freezer || {})
    .filter((f) => f && f.madeOn < date && !claimedIds.has(f.id))
    .sort((a, b) => (a.madeOn < b.madeOn ? -1 : 1));
}

/**
 * Fill every unlocked day that has someone eating.
 * Returns a new week object; the input is not modified.
 *
 * ctx: { recipes, settings, members (resolved), profile, rng, freezer, claimedFreezer }
 */
export function generateWeek(week, ctx) {
  const { recipes, settings, rng } = ctx;
  const recipesById = Object.fromEntries(recipes.map((r) => [r.id, r]));
  const next = structuredClone(week);

  const isKept = (d) => d.locked && (d.recipeId || d.fromFreezer);
  const lockedSlots = next.days.filter(isKept).map((d) => recipesById[d.recipeId]).filter(Boolean).map(slotForRecipe);
  const open = next.days.filter((d) => !isKept(d));
  for (const d of open) {
    d.recipeId = null;
    d.slot = null;
    d.explore = false;
    d.double = false;
    delete d.fromFreezer;
  }
  const cooking = open.filter((d) => d.eaters.length > 0);
  const slots = buildSlots(cooking.length, lockedSlots, settings, rng);

  // Treat night goes on the preferred day (or the nearest day to it).
  const assigned = new Map();
  const cheatSlots = slots.filter((s) => s === 'cheat');
  const rest = slots.filter((s) => s !== 'cheat');
  const byCheatPreference = cooking.slice().sort((a, b) => {
    const dist = (d) => {
      const diff = Math.abs(parseISODate(d.date).getDay() - settings.cheatDay);
      return Math.min(diff, 7 - diff);
    };
    return dist(a) - dist(b);
  });
  for (let i = 0; i < cheatSlots.length; i++) assigned.set(byCheatPreference[i].date, 'cheat');

  const remaining = cooking.filter((d) => !assigned.has(d.date));
  let best = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const order = shuffle(rest, rng);
    const full = next.days.map((d) => {
      if (isKept(d)) return slotForRecipe(recipesById[d.recipeId] || {});
      if (assigned.has(d.date)) return 'cheat';
      const idx = remaining.indexOf(d);
      return idx >= 0 ? order[idx] : null;
    });
    const p = arrangementPenalty(full);
    if (!best || p < best.p) best = { p, order };
    if (p === 0) break;
  }
  remaining.forEach((d, i) => assigned.set(d.date, best.order[i]));

  // Freezer nights: use up what's in the freezer on a weeknight.
  const claimed = new Set(ctx.claimedFreezer || []);
  for (const d of next.days) if (d.fromFreezer) claimed.add(d.fromFreezer);
  let freezerNights = quotaCount(settings.mix.freezer ?? 0, rng);
  const freezerDays = remaining
    .filter((d) => {
      const dow = parseISODate(d.date).getDay();
      return dow >= 1 && dow <= 4;
    })
    .sort((a, b) => {
      const pref = (d) => (assigned.get(d.date) === 'any' ? 0 : 1) + (d.eaters.length < settings.members.length ? -0.5 : 0);
      return pref(a) - pref(b);
    });
  for (const d of freezerDays) {
    if (freezerNights <= 0) break;
    const item = freezerAvailable(ctx.freezer, claimed, d.date)[0];
    if (!item) break;
    claimed.add(item.id);
    assigned.set(d.date, 'freezer');
    d.fromFreezer = item.id;
    d.recipeId = item.recipeId;
    freezerNights -= 1;
  }

  // Pick which slots are "try something new".
  const exploreCandidates = shuffle(remaining.filter((d) => assigned.get(d.date) !== 'freezer').map((d) => d.date), rng);
  const exploreDates = new Set(exploreCandidates.slice(0, quotaCount(settings.mix.newMeals, rng)));

  for (const day of cooking) {
    day.slot = assigned.get(day.date);
    if (day.slot === 'freezer') continue;
    day.explore = exploreDates.has(day.date);
    const pick = pickRecipe(next, day, ctx);
    day.recipeId = pick?.id ?? null;
  }

  if (settings.leftovers) planLeftovers(next, ctx, recipesById);
  if (settings.budget?.max) fitBudget(next, ctx, recipesById);
  return next;
}

// Roast on Sunday -> fried rice on Monday, and so on.
function planLeftovers(week, ctx, recipesById) {
  const blocked = new Set(ctx.settings.blocked || []);
  week.days.forEach((day, i) => {
    const nextDay = week.days[i + 1];
    const source = recipesById[day.recipeId];
    if (!source || day.fromFreezer || !nextDay || nextDay.locked || !nextDay.eaters.length) return;
    if (['cheat', 'freezer', 'leftover'].includes(nextDay.slot)) return;
    const options = ctx.recipes.filter((r) => r.leftoverOf === source.id && !blocked.has(r.id));
    const fits = options.filter((r) => nextDay.slot === 'any' || nextDay.slot === slotForRecipe(r));
    if (!fits.length) return;
    nextDay.recipeId = fits[Math.floor(ctx.rng() * fits.length)].id;
    nextDay.slot = 'leftover';
    nextDay.explore = false;
  });
}

export function weekCost(week, recipesById, ctx) {
  return buildShoppingList(week, recipesById, { members: ctx.members, regulars: ctx.settings.regulars }).totals;
}

/** Budget for the dinners: total budget minus regulars and "everything else". */
export function dinnerBudget(settings) {
  const b = settings.budget || {};
  const regulars = (settings.regulars || []).reduce((s, r) => s + regularCost(r), 0);
  return (b.max || 0) - (b.other || 0) - regulars;
}

// If the week is over budget, swap the priciest flexible dinners for cheaper
// ones in the same slot.
function fitBudget(week, ctx, recipesById) {
  const target = dinnerBudget(ctx.settings);
  const tried = new Set();
  for (let round = 0; round < 6; round++) {
    if (weekCost(week, recipesById, ctx).dinners <= target) return;
    const feedsLeftovers = (d, i) => recipesById[week.days[i + 1]?.recipeId]?.leftoverOf === d.recipeId;
    const flexible = week.days
      .filter((d, i) => d.recipeId && !d.locked && !d.fromFreezer && !tried.has(d.date) && !['cheat', 'leftover'].includes(d.slot) && !feedsLeftovers(d, i))
      .map((d) => ({ d, cost: recipeCost(recipesById[d.recipeId]) }))
      .sort((a, b) => b.cost - a.cost);
    if (!flexible.length) return;
    const { d, cost } = flexible[0];
    tried.add(d.date);
    const cheaper = rankCandidates(week, d, ctx).filter((c) => recipeCost(c.recipe) < cost * 0.8);
    if (cheaper.length) d.recipeId = cheaper[0].recipe.id;
  }
}

export function candidatesFor(week, day, { recipes, settings }) {
  const used = new Set(week.days.filter((d) => d !== day && d.date !== day.date && d.recipeId).map((d) => d.recipeId));
  const blocked = new Set(settings.blocked || []);
  const prev = week.days.find((d) => d.date === addDays(day.date, -1));
  const allowed = recipes.filter((r) =>
    !blocked.has(r.id) && !used.has(r.id)
    && !(settings.avoidNuts && r.tags.includes('nuts'))
    && (!r.leftoverOf || prev?.recipeId === r.leftoverOf));

  let list;
  if (day.slot === 'all') {
    list = allowed;
  } else if (day.slot === 'cheat') {
    list = allowed.filter((r) => r.cheat);
  } else if (day.slot && SLOT_PROTEINS[day.slot]) {
    list = allowed.filter((r) => !r.cheat && SLOT_PROTEINS[day.slot].includes(r.protein));
  } else {
    list = allowed.filter((r) => !r.cheat);
  }
  if (!list.length) list = allowed.filter((r) => !r.cheat);
  return list;
}

export function rankCandidates(week, day, ctx) {
  const { recipes, settings, profile } = ctx;
  const members = ctx.members || resolveMembers(settings.members, day.date);
  const recipesById = Object.fromEntries(recipes.map((r) => [r.id, r]));
  const eaters = members.filter((m) => day.eaters.includes(m.id));
  const picked = week.days
    .filter((d) => d !== day && d.date !== day.date && d.recipeId)
    .map((d) => ({ date: d.date, recipe: recipesById[d.recipeId] }));
  return candidatesFor(week, day, ctx)
    .map((recipe) => {
      const s = scoreRecipe(recipe, { profile, eaters, date: day.date, settings, explore: day.explore, picked });
      if (recipe.leftoverOf) {
        s.score += 3;
        s.reasons.unshift('Uses up yesterday\'s leftovers');
      }
      return { recipe, ...s };
    })
    .sort((a, b) => b.score - a.score);
}

export function pickRecipe(week, day, ctx, exclude = []) {
  const ranked = rankCandidates(week, day, ctx).filter((c) => !exclude.includes(c.recipe.id));
  if (!ranked.length) return null;
  const top = ranked.slice(0, 20);
  const T = 0.6;
  const max = top[0].score;
  const weights = top.map((c) => Math.exp((c.score - max) / T));
  return weightedPick(top, weights, ctx.rng).recipe;
}

// --------------------------------------------------------------- balance

export function weekBalance(week, recipesById, profile) {
  const meals = week.days.filter((d) => d.recipeId).map((d) => ({ day: d, recipe: recipesById[d.recipeId] })).filter((m) => m.recipe);
  const cooked = meals.filter((m) => m.recipe.id !== 'takeaway');
  const count = (fn) => meals.filter(fn).length;
  const vegTotal = cooked.reduce((s, m) => s + (m.recipe.veg || 0), 0);
  const stats = {
    meals: meals.length,
    oilyFish: count((m) => m.recipe.tags.includes('oily-fish')),
    redMeat: count((m) => m.recipe.tags.includes('red-meat')),
    chicken: count((m) => m.recipe.protein === 'chicken'),
    veggie: count((m) => m.recipe.protein === 'veggie'),
    cheat: count((m) => m.recipe.cheat),
    freezer: count((m) => m.day.fromFreezer),
    newDishes: count((m) => !profile.recipes[m.recipe.id]),
    cuisines: new Set(meals.filter((m) => !m.recipe.cheat).map((m) => m.recipe.cuisine)).size,
    vegPerMeal: cooked.length ? vegTotal / cooked.length : 0,
  };
  const checks = [
    { ok: stats.oilyFish >= 1, text: stats.oilyFish >= 1 ? `Oily fish ×${stats.oilyFish}` : 'No oily fish this week (aim for 1+)' },
    { ok: stats.redMeat <= 3, text: `Red meat ×${stats.redMeat}${stats.redMeat > 3 ? ' — on the high side' : ''}` },
    { ok: stats.vegPerMeal >= 1.5, text: `~${stats.vegPerMeal.toFixed(1)} veg portions per dinner` },
    { ok: true, text: `${stats.cuisines} cuisines` },
    { ok: true, text: stats.cheat ? `Treat night ×${stats.cheat}` : 'No treat night' },
  ];
  if (stats.freezer) checks.push({ ok: true, text: `From the freezer ×${stats.freezer}` });
  checks.push({ ok: true, text: stats.newDishes ? `New to try ×${stats.newDishes}` : 'All familiar dishes' });
  return { stats, checks };
}
