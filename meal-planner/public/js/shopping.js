// Shopping list: parse ingredient lines, scale to who's eating, merge across
// the week, group by aisle, and export (text, Sainsbury's links, calendar).

import { BASE_PORTIONS } from './recipes.js';
import { STAPLE_PRICE, DEFAULT_ITEM_PRICE, itemCost, regularCost, usedCost } from './prices.js';

export const CATEGORIES = ['Fruit & veg', 'Meat', 'Fish', 'Dairy & eggs', 'Bakery', 'Cupboard', 'Frozen', 'Regulars & extras'];

const COUNT_UNITS = {
  tin: 'tin', tins: 'tin', jar: 'jar', jars: 'jar', pack: 'pack', packs: 'pack', bag: 'bag', bags: 'bag',
  bunch: 'bunch', bunches: 'bunch', clove: 'clove', cloves: 'clove', bulb: 'bulb', bulbs: 'bulb',
  thumb: 'thumb', thumbs: 'thumb', stick: 'stick', sticks: 'stick', head: 'head', heads: 'head',
};
const MEASURE_UNITS = { g: 'g', kg: 'kg', ml: 'ml', l: 'l', litre: 'l', litres: 'l', tbsp: 'tbsp', tsp: 'tsp' };

export function parseIngredient(line) {
  const text = line.trim();
  const m = text.match(/^(\d+(?:\.\d+)?|\d+\/\d+)\s*([a-zA-Z]+)?\s*(.*)$/);
  if (!m) return { qty: null, unit: '', name: text.toLowerCase() };
  let qty = m[1].includes('/') ? m[1].split('/').reduce((a, b) => Number(a) / Number(b)) : Number(m[1]);
  let unit = '';
  let name = m[3];
  const word = (m[2] || '').toLowerCase();
  if (MEASURE_UNITS[word]) {
    unit = MEASURE_UNITS[word];
  } else if (COUNT_UNITS[word]) {
    unit = COUNT_UNITS[word];
  } else if (word) {
    name = `${m[2]} ${name}`.trim();
  }
  if (unit === 'kg') { qty *= 1000; unit = 'g'; }
  if (unit === 'l') { qty *= 1000; unit = 'ml'; }
  name = name.trim().toLowerCase();
  if (name === 'garlic' && unit === 'bulb') { qty *= 10; unit = 'clove'; }
  if (!unit) name = singularName(name);
  return { qty, unit, name };
}

// Counted items are stored singular so "1 lime" and "2 limes" merge.
export function singularName(name) {
  if (/(ss|us)$/.test(name) || !/s$/.test(name)) return name;
  if (/chillies$/.test(name)) return name.replace(/chillies$/, 'chilli');
  if (/oes$/.test(name)) return name.slice(0, -2);
  return name.slice(0, -1);
}

const CATEGORY_RULES = [
  ['Frozen', /\bfrozen\b/],
  ['Cupboard', /\b(noodles?|coconut milk|paste|sauce|stock|tortilla chips|peanut butter|salsa|pesto|pizza sauce|honey|mayonnaise|ketchup|seasoning)\b/],
  ['Fish', /\b(salmon|cod|haddock|fish|prawns?|tuna|mackerel)\b/],
  ['Meat', /\b(chicken|beef|steaks?|sirloin|rump|mince|lamb|pork|sausages?|chorizo|bacon|ham|pepperoni)\b/],
  ['Dairy & eggs', /\b(milk|cream|yoghurt|cheese|cheddar|feta|mozzarella|parmesan|halloumi|butter|eggs?|cheese slices)\b/],
  ['Bakery', /\b(bread|breads|pittas?|naan|tortilla|wraps?|buns?|flatbreads?|ciabatta|chapatis?|loaf|pizza bases?)\b/],
  ['Cupboard', /\b(rice|pasta|spaghetti|penne|fusilli|linguine|lasagne|orzo|couscous|panko|breadcrumbs|flour|peanuts|apricots|filo)\b/],
];

export function categorise(name, unit = '') {
  if (unit === 'tin' || unit === 'jar') return /\bfrozen\b/.test(name) ? 'Frozen' : 'Cupboard';
  for (const [cat, re] of CATEGORY_RULES) if (re.test(name)) return cat;
  return 'Fruit & veg';
}

export function sainsburysUrl(term) {
  return `https://www.sainsburys.co.uk/gol-ui/SearchResults/${encodeURIComponent(term.trim())}`;
}

export function portionsFor(eaterIds, members) {
  return members.filter((m) => eaterIds.includes(m.id)).reduce((s, m) => s + (Number(m.portion) || 0), 0);
}

function roundQty(qty, unit) {
  if (unit === 'g' || unit === 'ml') {
    const step = qty < 200 ? 10 : qty < 500 ? 25 : 50;
    return Math.max(step, Math.round(qty / step) * step);
  }
  if (unit === 'tbsp' || unit === 'tsp') return Math.max(1, Math.ceil(qty - 0.1));
  if (unit === 'clove') return Math.max(1, Math.round(qty));
  return Math.max(1, Math.ceil(qty - 0.2));
}

function plural(unit, n) {
  if (!unit || unit === 'g' || unit === 'ml' || unit === 'tbsp' || unit === 'tsp') return unit;
  if (n === 1) return unit;
  return unit === 'bunch' ? 'bunches' : `${unit}s`;
}

export function formatQty(qty, unit, name) {
  if (qty == null) return name;
  if (name === 'garlic' && unit === 'clove') {
    const bulbs = Math.max(1, Math.ceil(qty / 10));
    return `${bulbs} ${plural('bulb', bulbs)} garlic (${qty} ${plural('clove', qty)})`;
  }
  if (unit === 'g' && qty >= 1000) return `${+(qty / 1000).toFixed(2)}kg ${name}`;
  if (unit === 'ml' && qty >= 1000) return `${+(qty / 1000).toFixed(2)} litres ${name}`;
  if (unit === 'g' || unit === 'ml') return `${qty}${unit} ${name}`;
  if (unit) return `${qty} ${plural(unit, qty)} ${name}`;
  return `${qty} ${qty > 1 ? pluralName(name) : name}`;
}

const SAME_PLURAL = /(s|broccoli|corn on the cob|pak choi|halloumi|garlic|ginger|celery)$/;

export function pluralName(name) {
  if (SAME_PLURAL.test(name)) return name;
  if (/chilli$/.test(name)) return `${name}es`;
  if (/(o|ch|sh)$/.test(name)) return `${name}es`;
  return `${name}s`;
}

export function itemKey(name, unit) {
  return `${name}|${unit}`;
}

/** How much of a day's recipe to buy for: who's eating, cooking double, leftovers. */
export function dayScale(week, dayIndex, recipesById, members) {
  const day = week.days[dayIndex];
  const recipe = recipesById[day.recipeId];
  if (!recipe || !day.eaters.length || day.fromFreezer) return 0;
  let scale = portionsFor(day.eaters, members) / BASE_PORTIONS;
  if (day.double) scale *= 2;
  const next = week.days[dayIndex + 1];
  const nextRecipe = next && recipesById[next.recipeId];
  if (nextRecipe?.leftoverOf === recipe.id && !next.fromFreezer && next.eaters.length) {
    scale += (nextRecipe.extraScale || 0) * portionsFor(next.eaters, members) / BASE_PORTIONS;
  }
  return scale;
}

/** Proportional ingredient cost of a recipe for `portions` (no pack rounding). */
export function recipeCost(recipe, portions = BASE_PORTIONS) {
  const scale = portions / BASE_PORTIONS;
  return (recipe.ingredients || []).reduce((sum, line) => {
    const ing = parseIngredient(line);
    return sum + usedCost(ing.name, ing.qty == null ? null : ing.qty * scale, ing.unit);
  }, 0);
}

/**
 * @param week      { days, extras, staplesNeeded }
 * @param recipesById
 * @param options   { members (with numeric portion), regulars }
 * @returns {{ items, groups, staples, totals }}
 */
export function buildShoppingList(week, recipesById, { members, regulars = [] }) {
  const merged = new Map();
  const staples = new Map();
  week.days.forEach((day, i) => {
    const recipe = recipesById[day.recipeId];
    const scale = dayScale(week, i, recipesById, members);
    if (!recipe || !scale) return;
    for (const line of recipe.ingredients || []) {
      const ing = parseIngredient(line);
      const key = itemKey(ing.name, ing.unit);
      const entry = merged.get(key) || { key, name: ing.name, unit: ing.unit, qty: ing.qty == null ? null : 0, meals: [] };
      if (ing.qty != null && entry.qty != null) entry.qty += ing.qty * scale;
      if (!entry.meals.includes(recipe.name)) entry.meals.push(recipe.name);
      merged.set(key, entry);
    }
    for (const s of recipe.staples || []) {
      const entry = staples.get(s) || { key: `staple|${s}`, name: s, meals: [] };
      if (!entry.meals.includes(recipe.name)) entry.meals.push(recipe.name);
      staples.set(s, entry);
    }
  });

  const totals = { dinners: 0, regulars: 0, extras: 0, staples: 0 };
  const items = [...merged.values()].map((e) => {
    const qty = e.qty == null ? null : roundQty(e.qty, e.unit);
    const { cost } = itemCost(e.name, qty, e.unit);
    totals.dinners += cost;
    return {
      key: e.key,
      name: e.name,
      qty,
      unit: e.unit,
      display: formatQty(qty, e.unit, e.name),
      category: categorise(e.name, e.unit),
      meals: e.meals,
      url: sainsburysUrl(e.name),
      cost,
    };
  });

  for (const r of regulars) {
    const cost = regularCost(r);
    totals.regulars += cost;
    const term = r.replace(/\s*[x×]\s*\d+$/i, '');
    items.push({ key: `regular|${r}`, name: r, qty: null, unit: '', display: r, category: 'Regulars & extras', meals: ['Weekly regular'], url: sainsburysUrl(term), regular: true, cost });
  }
  for (const x of week.extras || []) {
    totals.extras += DEFAULT_ITEM_PRICE;
    items.push({ key: `extra|${x}`, name: x, qty: null, unit: '', display: x, category: 'Regulars & extras', meals: ['Added by you'], url: sainsburysUrl(x), extra: true, cost: DEFAULT_ITEM_PRICE });
  }
  for (const s of staples.values()) {
    if (week.staplesNeeded?.[s.key]) {
      totals.staples += STAPLE_PRICE;
      items.push({ key: s.key, name: s.name, qty: null, unit: '', display: s.name, category: 'Cupboard', meals: s.meals, url: sainsburysUrl(s.name), staple: true, cost: STAPLE_PRICE });
    }
  }
  totals.total = totals.dinners + totals.regulars + totals.extras + totals.staples;

  const groups = CATEGORIES.map((category) => ({
    category,
    items: items.filter((i) => i.category === category).sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.items.length);

  return { items, groups, staples: [...staples.values()].sort((a, b) => a.name.localeCompare(b.name)), totals };
}

export function listToText(list, title, checked = {}) {
  const lines = [title, ''];
  for (const g of list.groups) {
    const items = g.items.filter((i) => !checked[i.key]);
    if (!items.length) continue;
    lines.push(g.category.toUpperCase());
    for (const i of items) lines.push(`• ${cap(i.display)}`);
    lines.push('');
  }
  return lines.join('\n').trim();
}

export function cap(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

// ---------------------------------------------------------------- calendar

function icsEscape(s) {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function fold(line) {
  const out = [];
  let rest = line;
  while (rest.length > 73) {
    out.push(rest.slice(0, 73));
    rest = ` ${rest.slice(73)}`;
  }
  out.push(rest);
  return out.join('\r\n');
}

function icsStamp(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
}

/** A one-off calendar event with an alert — the most reliable phone reminder. */
export function buildICS({ title, description, start, durationMinutes = 15, uid }) {
  const end = new Date(start.getTime() + durationMinutes * 60000);
  const now = new Date();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Family Meal Planner//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid || `${start.getTime()}@family-meal-planner`}`,
    `DTSTAMP:${icsStamp(now)}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsEscape(title)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEscape(title)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n');
}
