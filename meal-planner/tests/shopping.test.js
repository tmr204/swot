import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RECIPES } from '../public/js/recipes.js';
import { DEFAULT_SETTINGS, emptyWeek, resolveMembers } from '../public/js/planner.js';
import {
  buildICS, buildShoppingList, categorise, formatQty, listToText, parseIngredient, sainsburysUrl,
} from '../public/js/shopping.js';
import { PRICES, itemCost, regularCost } from '../public/js/prices.js';

const settings = structuredClone(DEFAULT_SETTINGS);
const byId = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
const members = resolveMembers(settings.members, '2026-10-20');
const opts = { members, regulars: [] };
const START = '2026-10-20';

test('parses ingredient lines', () => {
  assert.deepEqual(parseIngredient('600g chicken thigh fillets'), { qty: 600, unit: 'g', name: 'chicken thigh fillets' });
  assert.deepEqual(parseIngredient('1kg potatoes'), { qty: 1000, unit: 'g', name: 'potatoes' });
  assert.deepEqual(parseIngredient('2 tins chopped tomatoes'), { qty: 2, unit: 'tin', name: 'chopped tomatoes' });
  assert.deepEqual(parseIngredient('6 pitta breads'), { qty: 6, unit: '', name: 'pitta bread' });
  assert.deepEqual(parseIngredient('2 limes'), { qty: 2, unit: '', name: 'lime' });
  assert.deepEqual(parseIngredient('2 red chillies'), { qty: 2, unit: '', name: 'red chilli' });
  assert.deepEqual(parseIngredient('1 little gem lettuce'), { qty: 1, unit: '', name: 'little gem lettuce' });
  assert.deepEqual(parseIngredient('1 bulb garlic'), { qty: 10, unit: 'clove', name: 'garlic' });
  assert.deepEqual(parseIngredient('salt'), { qty: null, unit: '', name: 'salt' });
});

test('every built-in ingredient has a quantity, an aisle and a price', () => {
  const expect = {
    'chicken stock': 'Cupboard', 'coconut milk': 'Cupboard', 'green beans': 'Fruit & veg', 'cherry tomatoes': 'Fruit & veg',
    'medium egg noodles': 'Cupboard', 'frozen peas': 'Frozen', 'greek yoghurt': 'Dairy & eggs', 'salmon fillet': 'Fish',
    'pitta bread': 'Bakery', 'peanut butter': 'Cupboard', beansprouts: 'Fruit & veg', 'tortilla chips': 'Cupboard',
    'fajita seasoning': 'Cupboard', egg: 'Dairy & eggs',
  };
  for (const [name, cat] of Object.entries(expect)) assert.equal(categorise(name), cat, name);
  const missing = new Set();
  for (const r of RECIPES) {
    for (const line of r.ingredients) {
      const ing = parseIngredient(line);
      assert.ok(ing.qty != null, `${r.id}: "${line}" has no quantity`);
      if (!itemCost(ing.name, ing.qty, ing.unit).known) missing.add(`${ing.name} (${ing.unit || 'each'})`);
    }
  }
  assert.deepEqual([...missing], [], 'ingredients without a price');
  assert.ok(Object.keys(PRICES).length > 100);
});

test('shopping list merges across meals and scales for who is eating', () => {
  const week = emptyWeek(START, settings.members);
  week.days[0].recipeId = 'chicken-souvlaki';   // 6 pittas, 250g Greek yoghurt
  week.days[1].recipeId = 'lamb-koftas';        // 6 pittas, 250g Greek yoghurt
  week.days[1].eaters = ['dad', 'ralph', 'arlo']; // 2.1 portions instead of 3.1
  const list = buildShoppingList(week, byId, opts);
  const pitta = list.items.find((i) => i.name === 'pitta bread');
  assert.equal(pitta.qty, Math.ceil(6 * 3.1 / 3 + 6 * 2.1 / 3 - 0.2));
  assert.equal(pitta.display, `${pitta.qty} pitta breads`);
  assert.ok(pitta.url.startsWith('https://www.sainsburys.co.uk/gol-ui/SearchResults/pitta%20bread'));
  assert.ok(list.staples.some((s) => s.name === 'olive oil'));
  assert.ok(list.totals.dinners > 5 && list.totals.dinners < 40);
});

test('cooking double doubles the shopping; freezer nights need none', () => {
  const week = emptyWeek(START, settings.members);
  week.days[0].recipeId = 'chilli-con-carne';
  const single = buildShoppingList(week, byId, opts).items.find((i) => i.name === 'beef mince').qty;
  week.days[0].double = true;
  const double = buildShoppingList(week, byId, opts).items.find((i) => i.name === 'beef mince').qty;
  assert.ok(double >= single * 1.9, `${single} -> ${double}`);
  week.days[0].double = false;
  week.days[0].fromFreezer = 'fz-x';
  assert.equal(buildShoppingList(week, byId, opts).items.length, 0);
});

test('leftovers: the source meal is bought bigger, the leftover meal only needs its sides', () => {
  const week = emptyWeek(START, settings.members);
  week.days[0].recipeId = 'chilli-con-carne';
  const alone = buildShoppingList(week, byId, opts).items.find((i) => i.name === 'beef mince').qty;
  week.days[1].recipeId = 'chilli-jackets';
  const list = buildShoppingList(week, byId, opts);
  const withLeftovers = list.items.find((i) => i.name === 'beef mince').qty;
  assert.ok(withLeftovers > alone * 1.4, `${alone} -> ${withLeftovers}`);
  assert.ok(list.items.some((i) => i.name === 'baking potato'));
});

test('regulars, extras, ticked staples, costs and text export', () => {
  const week = emptyWeek(START, settings.members);
  week.days[0].recipeId = 'roast-chicken';
  week.extras = ['Nappies'];
  week.staplesNeeded = { 'staple|gravy granules': true };
  const list = buildShoppingList(week, byId, { members, regulars: settings.regulars });
  assert.ok(list.items.some((i) => i.name === 'Milk x2' && i.regular && i.url.endsWith('/Milk')));
  assert.ok(list.items.some((i) => i.name === 'Nappies' && i.extra));
  assert.ok(list.items.some((i) => i.name === 'gravy granules' && i.staple));
  assert.equal(list.items.find((i) => i.name === 'garlic').display, '1 bulb garlic (10 cloves)');
  assert.equal(regularCost('Milk x2'), 3.3);
  assert.ok(Math.abs(list.totals.total - (list.totals.dinners + list.totals.regulars + list.totals.extras + list.totals.staples)) < 1e-9);
  const text = listToText(list, 'List', { 'regular|Milk x2': true });
  assert.ok(text.includes('FRUIT & VEG'));
  assert.ok(!text.includes('Milk'));
});

test('takeaway night adds nothing to the list', () => {
  const week = emptyWeek(START, settings.members);
  week.days[3].recipeId = 'takeaway';
  assert.equal(buildShoppingList(week, byId, opts).items.length, 0);
});

test('counted items read naturally', () => {
  assert.equal(formatQty(2, '', 'cucumber'), '2 cucumbers');
  assert.equal(formatQty(3, '', 'tomato'), '3 tomatoes');
  assert.equal(formatQty(2, '', 'red chilli'), '2 red chillies');
  assert.equal(formatQty(2, '', 'broccoli'), '2 broccoli');
  assert.equal(formatQty(1, '', 'lemon'), '1 lemon');
  assert.equal(formatQty(2, 'bunch', 'spring onions'), '2 bunches spring onions');
});

test('calendar reminder is a valid VEVENT with an alarm', () => {
  const ics = buildICS({ title: 'Shop', description: 'Line 1\nLine, 2', start: new Date(2026, 9, 18, 9, 0) });
  assert.ok(ics.includes('DTSTART:20261018T090000'));
  assert.ok(ics.includes('BEGIN:VALARM'));
  assert.ok(ics.includes('Line 1\\nLine\\, 2'));
  assert.ok(ics.split('\r\n').every((l) => l.length <= 75));
});

test('sainsbury search url encodes the term', () => {
  assert.equal(sainsburysUrl('chicken & chorizo'), 'https://www.sainsburys.co.uk/gol-ui/SearchResults/chicken%20%26%20chorizo');
});
