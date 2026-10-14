// Rough Sainsbury's prices (2025–26) used for the weekly budget estimate.
// They are ballpark figures, not live prices: the aim is "will this week be
// nearer £100 or £140?", not to the penny.
//
// name -> [pack size, unit, £ per pack]. Unit '' means "each".
// Items measured in tbsp are jars that last several weeks, so they're costed
// by the amount used rather than a whole jar each time.

export const PRICES = {
  apple: [1, '', 0.35],
  'arborio rice': [500, 'g', 1.85],
  avocado: [1, '', 0.85],
  'baby potatoes': [1000, 'g', 1.25],
  'baby spinach': [200, 'g', 1.4],
  'baked beans': [1, 'tin', 0.95],
  'baking potato': [1, '', 0.35],
  basil: [1, 'bunch', 0.85],
  'basmati rice': [1000, 'g', 2.5],
  beansprouts: [300, 'g', 0.85],
  'beef mince': [500, 'g', 4.0],
  'black bean sauce': [12, 'tbsp', 1.3],
  'black beans': [1, 'tin', 0.85],
  'brioche bun': [6, '', 1.65],
  broccoli: [1, '', 0.75],
  butter: [250, 'g', 2.3],
  'cannellini beans': [1, 'tin', 0.75],
  carrot: [1, '', 0.08],
  celery: [8, 'stick', 0.75],
  chapati: [6, '', 1.5],
  'cheese slice': [10, '', 1.8],
  'cherry tomatoes': [250, 'g', 1.1],
  'chestnut mushrooms': [250, 'g', 1.1],
  'chicken breast': [650, 'g', 4.75],
  'chicken thigh fillets': [500, 'g', 3.4],
  'chicken thigh': [8, '', 3.2],
  'chicken thighs': [1000, 'g', 3.2],
  chickpeas: [1, 'tin', 0.65],
  'chopped tomatoes': [1, 'tin', 0.55],
  chorizo: [225, 'g', 2.25],
  'coconut milk': [1, 'tin', 1.1],
  'cod fillets': [400, 'g', 5.0],
  'cooked ham': [150, 'g', 1.9],
  coriander: [1, 'bunch', 0.75],
  'corn on the cob': [2, '', 1.2],
  courgette: [1, '', 0.45],
  couscous: [500, 'g', 1.15],
  'cream cheese': [180, 'g', 1.1],
  'crusty loaf': [1, '', 1.2],
  cucumber: [1, '', 0.75],
  'diced lamb': [400, 'g', 6.0],
  'double cream': [300, 'ml', 1.55],
  'dried apricots': [250, 'g', 1.75],
  egg: [6, '', 1.85],
  'fajita seasoning': [1, 'pack', 0.95],
  feta: [200, 'g', 1.6],
  'filo pastry': [1, 'pack', 2.0],
  'flat rice noodles': [200, 'g', 1.3],
  flatbread: [6, '', 1.6],
  'frozen battered fish fillet': [4, '', 4.0],
  'frozen edamame beans': [500, 'g', 2.25],
  'frozen fries': [1000, 'g', 2.0],
  'frozen oven chips': [1000, 'g', 1.6],
  'frozen peas': [1000, 'g', 1.6],
  'frozen spinach': [450, 'g', 1.3],
  fusilli: [500, 'g', 0.75],
  garlic: [10, 'clove', 0.35],
  ginger: [3, 'thumb', 0.5],
  'grated cheddar': [250, 'g', 2.5],
  'grated mozzarella': [250, 'g', 2.1],
  'greek yoghurt': [500, 'g', 1.6],
  'green beans': [200, 'g', 1.2],
  'green pesto': [12, 'tbsp', 1.6],
  halloumi: [1, 'pack', 2.75],
  hummus: [200, 'g', 1.1],
  'jasmine rice': [1000, 'g', 2.6],
  'jerk paste': [10, 'tbsp', 2.0],
  'kidney beans': [1, 'tin', 0.6],
  'korma curry paste': [12, 'tbsp', 1.6],
  'lamb mince': [500, 'g', 4.75],
  'lasagne sheets': [250, 'g', 0.95],
  lemon: [1, '', 0.35],
  lime: [1, '', 0.3],
  linguine: [500, 'g', 0.95],
  'little gem lettuce': [2, '', 0.85],
  'long grain rice': [1000, 'g', 1.3],
  mangetout: [150, 'g', 1.2],
  'maris piper potatoes': [2000, 'g', 1.5],
  'medium egg noodles': [300, 'g', 1.1],
  milk: [2272, 'ml', 1.65],
  'mixed salad': [1, 'bag', 1.0],
  'mushy peas': [1, 'tin', 0.55],
  'naan bread': [2, '', 1.0],
  'natural yoghurt': [500, 'g', 0.85],
  onion: [1, '', 0.15],
  orzo: [500, 'g', 1.5],
  'oyster sauce': [12, 'tbsp', 1.6],
  'pad thai sauce': [8, 'tbsp', 1.5],
  'paella rice': [500, 'g', 2.0],
  'pak choi': [1, '', 0.8],
  'panko breadcrumbs': [200, 'g', 1.2],
  parmesan: [200, 'g', 3.75],
  parsley: [1, 'bunch', 0.75],
  'peanut butter': [24, 'tbsp', 2.0],
  penne: [500, 'g', 0.75],
  pepper: [3, '', 1.55],
  pepperoni: [100, 'g', 1.5],
  'pineapple chunks': [1, 'tin', 0.95],
  'pitta bread': [6, '', 0.85],
  'pizza base': [2, '', 1.5],
  'pizza sauce': [1, 'jar', 1.2],
  'pork loin chop': [4, '', 4.0],
  'pork mince': [500, 'g', 3.3],
  'pork sausage': [8, '', 2.75],
  potatoes: [2000, 'g', 1.5],
  'raw king prawns': [225, 'g', 3.75],
  'red chilli': [1, '', 0.3],
  'red onion': [1, '', 0.2],
  'red pepper': [1, '', 0.6],
  'roasted peanuts': [200, 'g', 1.4],
  rocket: [60, 'g', 1.0],
  'rump steak': [250, 'g', 4.25],
  'salmon fillet': [4, '', 6.75],
  salsa: [1, 'jar', 1.5],
  'savoy cabbage': [1, '', 0.8],
  'sirloin steak': [225, 'g', 4.75],
  'sirloin steaks': [225, 'g', 4.75],
  'small red cabbage': [1, '', 0.8],
  'small tortilla wrap': [8, '', 1.1],
  'soured cream': [300, 'ml', 1.1],
  spaghetti: [500, 'g', 0.75],
  'spring onions': [1, 'bunch', 0.6],
  'sugar snap peas': [150, 'g', 1.2],
  'sushi rice': [500, 'g', 2.0],
  'sweet potato': [1, '', 0.35],
  'sweet potatoes': [1000, 'g', 1.2],
  sweetcorn: [325, 'g', 0.75],
  'tenderstem broccoli': [200, 'g', 1.75],
  'teriyaki sauce': [16, 'tbsp', 1.6],
  'thai green curry paste': [12, 'tbsp', 1.3],
  'tikka curry paste': [12, 'tbsp', 1.6],
  tomato: [6, '', 0.85],
  'tortilla chips': [1, 'bag', 1.1],
  'tortilla wrap': [8, '', 1.1],
  tuna: [1, 'tin', 1.1],
  'whole chicken': [1, '', 5.0],
};

// "Sirloin steaks" bought by count are costed per steak.
const COUNT_OVERRIDES = { 'sirloin steak': [1, '', 4.75] };

export const REGULAR_PRICES = {
  milk: 1.65,
  bread: 1.4,
  bananas: 0.95,
  apples: 1.9,
  "kids' yoghurts": 1.6,
  'breakfast cereal': 2.5,
};

export const DEFAULT_ITEM_PRICE = 2.0;
export const STAPLE_PRICE = 1.5;

function lookup(name, unit) {
  if (!unit && COUNT_OVERRIDES[name]) return COUNT_OVERRIDES[name];
  return PRICES[name] || null;
}

/** Cost of buying `qty` of an item, rounded up to whole packs. */
export function itemCost(name, qty, unit) {
  const entry = lookup(name, unit);
  if (!entry || qty == null) return { cost: DEFAULT_ITEM_PRICE, known: false };
  const [size, pUnit, price] = entry;
  if (pUnit !== unit) return { cost: DEFAULT_ITEM_PRICE, known: false };
  if (unit === 'tbsp' || unit === 'tsp') return { cost: Math.max(0.3, (qty / size) * price), known: true };
  const packs = Math.max(1, Math.ceil(qty / size - 0.05));
  return { cost: packs * price, known: true, packs };
}

/** Proportional cost (no pack rounding) — used to compare recipes. */
export function usedCost(name, qty, unit) {
  const entry = lookup(name, unit);
  if (!entry || qty == null || entry[1] !== unit) return 0.6;
  const [size, , price] = entry;
  return (qty / size) * price;
}

/** "Milk x2" -> 2 × milk price. */
export function regularCost(line) {
  const m = line.trim().match(/^(.*?)(?:\s*[x×]\s*(\d+))?$/i);
  const name = (m?.[1] || line).trim().toLowerCase();
  const times = Number(m?.[2] || 1);
  return (REGULAR_PRICES[name] ?? DEFAULT_ITEM_PRICE) * times;
}

export function formatPounds(n) {
  return `£${n.toFixed(n >= 100 ? 0 : 2).replace(/\.00$/, '')}`;
}
