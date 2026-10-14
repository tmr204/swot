import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RECIPES } from '../js/recipes.js';
import { DEFAULT_SETTINGS, emptyWeek } from '../js/planner.js';
import { buildICS, buildShoppingList, categorise, listToText, parseIngredient, sainsburysUrl } from '../js/shopping.js';

const settings = structuredClone(DEFAULT_SETTINGS);
const byId = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

test('parses ingredient lines', () => {
  assert.deepEqual(parseIngredient('600g chicken thigh fillets'), { qty: 600, unit: 'g', name: 'chicken thigh fillets' });
  assert.deepEqual(parseIngredient('1kg potatoes'), { qty: 1000, unit: 'g', name: 'potatoes' });
  assert.deepEqual(parseIngredient('2 tins chopped tomatoes'), { qty: 2, unit: 'tin', name: 'chopped tomatoes' });
  assert.deepEqual(parseIngredient('6 pitta breads'), { qty: 6, unit: '', name: 'pitta breads' });
  assert.deepEqual(parseIngredient('1 little gem lettuce'), { qty: 1, unit: '', name: 'little gem lettuce' });
  assert.deepEqual(parseIngredient('1 bulb garlic'), { qty: 10, unit: 'clove', name: 'garlic' });
  assert.deepEqual(parseIngredient('salt'), { qty: null, unit: '', name: 'salt' });
});

test('every built-in ingredient lands in a sensible aisle', () => {
  const expect = {
    'chicken stock': 'Cupboard', 'coconut milk': 'Cupboard', 'green beans': 'Fruit & veg', 'cherry tomatoes': 'Fruit & veg',
    'medium egg noodles': 'Cupboard', 'frozen peas': 'Frozen', 'greek yoghurt': 'Dairy & eggs', 'salmon fillets': 'Fish',
    'pitta breads': 'Bakery', 'peanut butter': 'Cupboard', 'beansprouts': 'Fruit & veg', 'tortilla chips': 'Cupboard',
    'fajita seasoning': 'Cupboard',
  };
  for (const [name, cat] of Object.entries(expect)) assert.equal(categorise(name), cat, name);
  assert.equal(categorise('chopped tomatoes', 'tin'), 'Cupboard');
  for (const r of RECIPES) for (const line of r.ingredients) assert.ok(parseIngredient(line).qty != null, `${r.id}: "${line}" has no quantity`);
});

test('shopping list merges across meals and scales for who is eating', () => {
  const week = emptyWeek('2026-10-18', settings.members);
  week.days[0].recipeId = 'chicken-souvlaki';   // pittas, 250g Greek yoghurt
  week.days[1].recipeId = 'lamb-koftas';        // pittas, 250g Greek yoghurt
  week.days[1].eaters = ['dad', 'boy1', 'boy2']; // 2 portions instead of 3
  const list = buildShoppingList(week, byId, { ...settings, regulars: [] });
  const pitta = list.items.find((i) => i.name === 'pitta breads');
  assert.equal(pitta.qty, 10); // 6 + 6×2/3
  const yoghurt = list.items.find((i) => i.name === 'greek yoghurt');
  assert.equal(yoghurt.qty, 425); // 250 + 166.7 → rounded
  assert.deepEqual(pitta.meals, ['Chicken souvlaki, pittas & tzatziki', 'Greek lamb koftas with pitta & tzatziki']);
  assert.ok(pitta.url.startsWith('https://www.sainsburys.co.uk/gol-ui/SearchResults/pitta%20breads'));
  assert.ok(list.staples.some((s) => s.name === 'olive oil'));
});

test('regulars, extras, ticked staples and text export', () => {
  const week = emptyWeek('2026-10-18', settings.members);
  week.days[0].recipeId = 'roast-chicken';
  week.extras = ['Nappies'];
  week.staplesNeeded = { 'staple|gravy granules': true };
  const list = buildShoppingList(week, byId, settings);
  assert.ok(list.items.some((i) => i.name === 'Milk' && i.regular));
  assert.ok(list.items.some((i) => i.name === 'Nappies' && i.extra));
  assert.ok(list.items.some((i) => i.name === 'gravy granules' && i.staple));
  const garlic = list.items.find((i) => i.name === 'garlic');
  assert.equal(garlic.display, '1 bulb garlic (10 cloves)');
  const text = listToText(list, 'List', { 'regular|Milk': true });
  assert.ok(text.includes('FRUIT & VEG'));
  assert.ok(!text.includes('Milk'));
});

test('takeaway night adds nothing to the list', () => {
  const week = emptyWeek('2026-10-18', settings.members);
  week.days[5].recipeId = 'takeaway';
  const list = buildShoppingList(week, byId, { ...settings, regulars: [] });
  assert.equal(list.items.length, 0);
});

test('calendar reminder is a valid VEVENT with an alarm', () => {
  const ics = buildICS({ title: 'Shop', description: 'Line 1\nLine, 2', start: new Date(2026, 9, 17, 9, 0) });
  assert.ok(ics.includes('DTSTART:20261017T090000'));
  assert.ok(ics.includes('BEGIN:VALARM'));
  assert.ok(ics.includes('Line 1\\nLine\\, 2'));
  assert.ok(ics.split('\r\n').every((l) => l.length <= 75));
});

test('sainsbury search url encodes the term', () => {
  assert.equal(sainsburysUrl('chicken & chorizo'), 'https://www.sainsburys.co.uk/gol-ui/SearchResults/chicken%20%26%20chorizo');
});

test('counted items read naturally', async () => {
  const { formatQty } = await import('../js/shopping.js');
  assert.equal(formatQty(2, '', 'cucumber'), '2 cucumbers');
  assert.equal(formatQty(3, '', 'tomato'), '3 tomatoes');
  assert.equal(formatQty(2, '', 'red chilli'), '2 red chillies');
  assert.equal(formatQty(2, '', 'broccoli'), '2 broccoli');
  assert.equal(formatQty(5, '', 'peppers'), '5 peppers');
  assert.equal(formatQty(1, '', 'lemon'), '1 lemon');
  assert.equal(formatQty(2, 'bunch', 'spring onions'), '2 bunches spring onions');
});
