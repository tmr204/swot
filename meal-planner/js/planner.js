// Planning logic: weekly mix, learning from ratings, and picking meals.
// Pure functions only (no DOM, no storage) so it can be unit tested in Node.

export const RATINGS = [
  { value: 2, emoji: '😍', label: 'Loved it' },
  { value: 1, emoji: '👍', label: 'Liked it' },
  { value: 0, emoji: '😐', label: 'Meh' },
  { value: -2, emoji: '👎', label: 'Not again' },
];

export const DEFAULT_SETTINGS = {
  members: [
    { id: 'dad', name: 'Dad', portion: 1, child: false },
    { id: 'mum', name: 'Mum', portion: 1, child: false },
    { id: 'boy1', name: 'Big boy (5)', portion: 0.5, child: true },
    { id: 'boy2', name: 'Little boy (3)', portion: 0.5, child: true },
  ],
  // Meals per week on average. 0.5 means "every other week".
  mix: { chicken: 2.5, steak: 1, salmon: 1, mince: 0.5, veggie: 0, cheat: 1, newMeals: 1 },
  weekStart: 0,      // 0 = Sunday
  shoppingDay: 6,    // 6 = Saturday
  cheatDay: 5,       // 5 = Friday
  weeknightMaxTime: 40,
  avoidNuts: false,
  blocked: [],
  favourites: [],
  regulars: ['Milk', 'Bread', 'Bananas', 'Apples', 'Kids\' yoghurts', 'Breakfast cereal'],
  notifications: false,
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

export function emptyWeek(start, members) {
  return {
    start,
    days: Array.from({ length: 7 }, (_, i) => ({
      date: addDays(start, i),
      recipeId: null,
      slot: null,
      explore: false,
      locked: false,
      eaters: members.map((m) => m.id),
      ratings: {},
    })),
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

// Flatten every planned day into a history list. Only days on or before
// `today` count as cooked.
export function collectHistory(weeks, today) {
  const out = [];
  for (const week of Object.values(weeks)) {
    for (const day of week.days) {
      if (day.recipeId && day.date <= today) {
        out.push({ date: day.date, recipeId: day.recipeId, ratings: day.ratings || {}, eaters: day.eaters });
      }
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
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
    const values = Object.entries(h.ratings || {});
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
    if (memberAvgs.some((a) => a <= -1.5)) {
      score -= 1.5;
    }
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

  // Gentle nudge towards veg-heavy dishes.
  score += 0.15 * (recipe.veg || 0);

  return { score, reasons };
}

// ------------------------------------------------------------- generation

function quotaCount(value, rng) {
  const whole = Math.floor(value);
  return whole + (rng() < value - whole ? 1 : 0);
}

function slotForRecipe(recipe) {
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

function adjacencyPenalty(order) {
  let p = 0;
  for (let i = 1; i < order.length; i++) {
    if (order[i] === order[i - 1] && order[i] !== 'any') p += 1;
  }
  return p;
}

/**
 * Fill every unlocked day that has someone eating.
 * Returns a new week object; the input is not modified.
 */
export function generateWeek(week, ctx) {
  const { recipes, settings, profile, rng } = ctx;
  const recipesById = Object.fromEntries(recipes.map((r) => [r.id, r]));
  const members = settings.members;
  const next = structuredClone(week);

  const lockedDays = next.days.filter((d) => d.locked && d.recipeId);
  const lockedSlots = lockedDays.map((d) => recipesById[d.recipeId]).filter(Boolean).map(slotForRecipe);
  const open = next.days.filter((d) => !(d.locked && d.recipeId));
  for (const d of open) {
    d.recipeId = null;
    d.slot = null;
    d.explore = false;
  }
  const cooking = open.filter((d) => d.eaters.length > 0);
  const slots = buildSlots(cooking.length, lockedSlots, settings, rng);

  // Cheat night goes on the preferred day (or the nearest day to it).
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
  for (let attempt = 0; attempt < 25; attempt++) {
    const order = shuffle(rest, rng);
    const full = next.days.map((d) => {
      if (d.locked && d.recipeId) return slotForRecipe(recipesById[d.recipeId] || {});
      if (assigned.has(d.date)) return 'cheat';
      const idx = remaining.indexOf(d);
      return idx >= 0 ? order[idx] : null;
    });
    const p = adjacencyPenalty(full);
    if (!best || p < best.p) best = { p, order };
    if (p === 0) break;
  }
  remaining.forEach((d, i) => assigned.set(d.date, best.order[i]));

  // Pick which slots are "try something new".
  const exploreCandidates = shuffle(remaining.map((d) => d.date), rng);
  const exploreDates = new Set(exploreCandidates.slice(0, quotaCount(settings.mix.newMeals, rng)));

  for (const day of cooking) {
    day.slot = assigned.get(day.date);
    day.explore = exploreDates.has(day.date);
    const pick = pickRecipe(next, day, { recipes, settings, profile, rng });
    day.recipeId = pick?.id ?? null;
  }
  return next;
}

export function candidatesFor(week, day, { recipes, settings }) {
  const used = new Set(week.days.filter((d) => d !== day && d.recipeId).map((d) => d.recipeId));
  const blocked = new Set(settings.blocked || []);
  const allowed = recipes.filter((r) =>
    !blocked.has(r.id) && !used.has(r.id) && !(settings.avoidNuts && r.tags.includes('nuts')));

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
  const recipesById = Object.fromEntries(recipes.map((r) => [r.id, r]));
  const eaters = settings.members.filter((m) => day.eaters.includes(m.id));
  const picked = week.days
    .filter((d) => d !== day && d.recipeId)
    .map((d) => ({ date: d.date, recipe: recipesById[d.recipeId] }));
  return candidatesFor(week, day, ctx)
    .map((recipe) => ({
      recipe,
      ...scoreRecipe(recipe, { profile, eaters, date: day.date, settings, explore: day.explore, picked }),
    }))
    .sort((a, b) => b.score - a.score);
}

export function pickRecipe(week, day, ctx, exclude = []) {
  const ranked = rankCandidates(week, day, ctx).filter((c) => !exclude.includes(c.recipe.id));
  if (!ranked.length) return null;
  const top = ranked.slice(0, 8);
  const T = 0.6;
  const max = top[0].score;
  const weights = top.map((c) => Math.exp((c.score - max) / T));
  return weightedPick(top, weights, ctx.rng).recipe;
}

// --------------------------------------------------------------- balance

export function weekBalance(week, recipesById, settings, profile) {
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
    { ok: true, text: stats.newDishes ? `New to try ×${stats.newDishes}` : 'All familiar dishes' },
  ];
  return { stats, checks };
}
