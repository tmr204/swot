import { RECIPES, PROTEIN_EMOJI, PROTEIN_LABELS, BASE_PORTIONS } from './recipes.js';
import {
  RATINGS, DAY_NAMES, addDays, buildProfile, collectHistory, daysBetween, emptyWeek, generateWeek,
  parseISODate, pickRecipe, rankCandidates, scoreRecipe, seededRandom, toISODate, weekBalance, weekStartFor,
} from './planner.js';
import {
  buildICS, buildShoppingList, cap, formatQty, listToText, parseIngredient, portionsFor,
} from './shopping.js';
import {
  applySharedWeek, loadState, mergeBackup, readShareHash, saveState, weekShareLink,
} from './store.js';

// ------------------------------------------------------------------ state

const state = loadState();
const ui = {
  tab: 'plan',
  weekStart: null,
  mealSearch: '',
  mealCuisine: '',
  mealProtein: '',
};
const rng = seededRandom(Date.now() & 0xffffffff);

const $ = (sel, root = document) => root.querySelector(sel);
const view = $('#view');
const sheet = $('#sheet');
const sheetBody = $('#sheet-body');

function h(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function todayISO() {
  return toISODate(new Date());
}

function save() {
  if (!saveState(state)) toast('Could not save — is storage full?');
}

function allRecipes() {
  return [...RECIPES, ...state.customRecipes];
}

function recipesById() {
  return Object.fromEntries(allRecipes().map((r) => [r.id, r]));
}

function profile() {
  return buildProfile(collectHistory(state.weeks, todayISO()), recipesById());
}

function planCtx() {
  return { recipes: allRecipes(), settings: state.settings, profile: profile(), rng };
}

function members() {
  return state.settings.members;
}

// The week we're planning: from shopping day onwards that's next week.
function defaultWeekStart() {
  const { weekStart, shoppingDay } = state.settings;
  const today = new Date();
  const thisWeek = weekStartFor(today, weekStart);
  const idxToday = (today.getDay() - weekStart + 7) % 7;
  const idxShop = (shoppingDay - weekStart + 7) % 7;
  return idxToday >= idxShop && idxShop >= 5 ? addDays(thisWeek, 7) : thisWeek;
}

function getWeek(start = ui.weekStart, create = false) {
  let week = state.weeks[start];
  if (!week) {
    week = emptyWeek(start, members());
    if (create) state.weeks[start] = week;
  }
  return week;
}

function fmtDate(iso, long = false) {
  const d = parseISODate(iso);
  const day = DAY_NAMES[d.getDay()];
  const month = d.toLocaleDateString('en-GB', { month: 'short' });
  return `${long ? day : day.slice(0, 3)} ${d.getDate()} ${month}`;
}

function memberShort(m) {
  return m.name.split(/\s+/)[0];
}

function eatersLabel(ids) {
  const ms = members();
  if (ids.length === ms.length) return '';
  if (!ids.length) return 'Nobody home';
  return `One-off: ${ms.filter((m) => ids.includes(m.id)).map(memberShort).join(' + ')}`;
}

function shoppingDateFor(weekStart) {
  const { shoppingDay } = state.settings;
  const startDow = parseISODate(weekStart).getDay();
  const back = (startDow - shoppingDay + 7) % 7 || 7;
  return addDays(weekStart, -back);
}

// ------------------------------------------------------------------ UI bits

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

function openSheet(html) {
  sheetBody.innerHTML = `<button class="sheet-close" data-action="close-sheet" aria-label="Close">✕</button>${html}`;
  if (!sheet.open) sheet.showModal();
  sheetBody.scrollTop = 0;
}

function closeSheet() {
  if (sheet.open) sheet.close();
}

sheet.addEventListener('click', (e) => {
  if (e.target === sheet) closeSheet();
});

function badge(text, cls = '') {
  return `<span class="badge ${cls}">${h(text)}</span>`;
}

function recipeBadges(recipe, { isNew } = {}) {
  const out = [badge(recipe.cuisine)];
  if (recipe.time) out.push(badge(`${recipe.time} min`));
  if (recipe.cheat) out.push(badge('Treat', 'treat'));
  if (recipe.kid) out.push(badge('Kid-friendly', 'kid'));
  if (recipe.tags.includes('spicy')) out.push(badge('Spicy', 'spicy'));
  if (recipe.tags.includes('oily-fish')) out.push(badge('Oily fish', 'good'));
  if (recipe.tags.includes('nuts')) out.push(badge('Nuts', 'warn'));
  if (isNew) out.push(badge('New to you', 'new'));
  return out.join('');
}

async function shareOrCopy({ title, text, url }) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText([text, url].filter(Boolean).join('\n'));
    toast('Copied to clipboard');
  } catch {
    toast('Sharing not available on this device');
  }
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

// ------------------------------------------------------------------ render

function render() {
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === ui.tab));
  const views = { plan: renderPlan, shop: renderShop, meals: renderMeals, settings: renderSettings };
  views[ui.tab]();
}

function weekNav(label) {
  return `
    <div class="week-nav">
      <button class="icon-btn" data-action="week-prev" aria-label="Previous week">‹</button>
      <div class="week-label"><small>${h(label)}</small><strong>w/c ${h(fmtDate(ui.weekStart, true))}</strong></div>
      <button class="icon-btn" data-action="week-next" aria-label="Next week">›</button>
    </div>`;
}

function shoppingDayBanner() {
  const today = todayISO();
  if (parseISODate(today).getDay() !== state.settings.shoppingDay) return '';
  return `<div class="banner">🛒 It's shopping day — your list for next week is on the <button class="link" data-action="tab" data-tab="shop">Shop</button> tab.</div>`;
}

// --- Plan
function renderPlan() {
  $('#title').textContent = 'Meal plan';
  $('#topbar-actions').innerHTML = '';
  const week = getWeek();
  const byId = recipesById();
  const prof = profile();
  const today = todayISO();
  const hasMeals = week.days.some((d) => d.recipeId);
  const relative = ui.weekStart === weekStartFor(new Date(), state.settings.weekStart) ? 'This week'
    : daysBetween(weekStartFor(new Date(), state.settings.weekStart), ui.weekStart) === 7 ? 'Next week' : '';

  let html = shoppingDayBanner() + weekNav(relative);

  if (!hasMeals) {
    html += `
      <section class="card empty">
        <p>Nothing planned yet for this week.</p>
        <p class="muted">Tap a name on any day first if someone's out, then let the planner fill the week.</p>
        <button class="primary big" data-action="generate">✨ Plan this week</button>
      </section>`;
  } else {
    const { checks } = weekBalance(week, byId, state.settings, prof);
    html += `
      <section class="card balance">
        <div class="balance-head"><strong>Balance check</strong></div>
        <div class="chips">${checks.map((c) => `<span class="chip ${c.ok ? 'ok' : 'warn'}">${c.ok ? '✓' : '!'} ${h(c.text)}</span>`).join('')}</div>
      </section>
      <div class="row-actions">
        <button data-action="generate">↻ Re-plan unlocked</button>
        <button data-action="share-week">📤 Send to partner</button>
      </div>`;
  }

  html += week.days.map((day, i) => renderDay(week, day, i, byId, prof, today)).join('');
  html += `<p class="muted center small">🔒 Lock a day to keep it when re-planning. Tap names to say who's eating.</p>`;
  view.innerHTML = html;
}

function renderDay(week, day, index, byId, prof, today) {
  const recipe = byId[day.recipeId];
  const past = day.date < today;
  const isToday = day.date === today;
  const eaterChips = members().map((m) => `
    <button class="eater ${day.eaters.includes(m.id) ? 'on' : ''}" data-action="toggle-eater" data-day="${index}" data-member="${h(m.id)}"
      aria-pressed="${day.eaters.includes(m.id)}">${h(memberShort(m))}</button>`).join('');
  const oneOff = eatersLabel(day.eaters);

  let body;
  if (recipe) {
    const eaters = members().filter((m) => day.eaters.includes(m.id));
    const picked = week.days.filter((d) => d !== day && d.recipeId).map((d) => ({ date: d.date, recipe: byId[d.recipeId] }));
    const { reasons } = scoreRecipe(recipe, { profile: prof, eaters, date: day.date, settings: state.settings, explore: day.explore, picked });
    const slotNote = day.slot === 'cheat' ? 'Treat night' : day.explore ? 'Something new' : reasons[0] || '';
    body = `
      <button class="meal" data-action="open-recipe" data-id="${h(recipe.id)}" data-day="${index}">
        <span class="emoji" aria-hidden="true">${PROTEIN_EMOJI[recipe.protein] || '🍽️'}</span>
        <span class="meal-text">
          <span class="meal-name">${h(recipe.name)}</span>
          <span class="meta">${h(recipe.cuisine)}${recipe.time ? ` · ${recipe.time} min` : ''}${slotNote ? ` · ${h(slotNote)}` : ''}</span>
        </span>
      </button>`;
  } else if (!day.eaters.length) {
    body = `<p class="muted">Nobody home — no cooking 🎉</p>`;
  } else {
    body = `<button class="ghost" data-action="swap" data-day="${index}">+ Suggest a meal</button>`;
  }

  let rating = '';
  if (recipe && (past || isToday) && recipe.id !== 'takeaway') {
    const given = Object.entries(day.ratings || {});
    rating = given.length
      ? `<button class="rating-summary" data-action="rate" data-day="${index}">${given.map(([mid, v]) => {
        const m = members().find((x) => x.id === mid);
        const r = RATINGS.find((x) => x.value === v);
        return m && r ? `<span>${h(memberShort(m))} ${r.emoji}</span>` : '';
      }).join('')}</button>`
      : `<button class="rate-cta" data-action="rate" data-day="${index}">How was it? Rate it so I can learn ⭐</button>`;
  }

  return `
    <article class="card day ${isToday ? 'today' : ''} ${past ? 'past' : ''}">
      <div class="day-head">
        <div class="day-date"><strong>${h(DAY_NAMES[parseISODate(day.date).getDay()].slice(0, 3))}</strong> ${parseISODate(day.date).getDate()}${isToday ? badge('Today', 'today') : ''}</div>
        <div class="eaters" role="group" aria-label="Who's eating">${eaterChips}</div>
      </div>
      ${oneOff ? `<div class="oneoff">${h(oneOff)}</div>` : ''}
      ${body}
      ${recipe ? `
      <div class="day-actions">
        <button data-action="lock" data-day="${index}" class="${day.locked ? 'on' : ''}" aria-pressed="${day.locked}">${day.locked ? '🔒 Locked' : '🔓 Lock'}</button>
        <button data-action="swap" data-day="${index}">↻ Swap</button>
        <button data-action="choose" data-day="${index}">☰ Choose</button>
        <button data-action="clear-day" data-day="${index}" aria-label="Clear">✕</button>
      </div>` : ''}
      ${rating}
    </article>`;
}

// --- Recipe sheet
function openRecipe(id, dayIndex) {
  const recipe = recipesById()[id];
  if (!recipe) return;
  const week = getWeek();
  const day = dayIndex != null ? week.days[dayIndex] : null;
  const eaterIds = day ? day.eaters : members().map((m) => m.id);
  const portions = portionsFor(eaterIds, members());
  const scale = portions / BASE_PORTIONS;
  const prof = profile();
  const stats = prof.recipes[id];
  const fav = state.settings.favourites.includes(id);
  const blocked = state.settings.blocked.includes(id);

  const ingredients = recipe.ingredients.map((line) => {
    const ing = parseIngredient(line);
    if (ing.qty == null) return `<li>${h(cap(ing.name))}</li>`;
    const qty = ing.unit === 'g' || ing.unit === 'ml' ? Math.round(ing.qty * scale / 5) * 5 : +(ing.qty * scale).toFixed(1);
    return `<li>${h(cap(formatQty(qty, ing.unit, ing.name)))}</li>`;
  }).join('');

  let history = '<p class="muted small">Not cooked yet.</p>';
  if (stats) {
    const rows = members().map((m) => {
      const s = stats.byMember[m.id];
      if (!s) return '';
      const avg = s.sum / s.n;
      const r = RATINGS.reduce((best, x) => (Math.abs(x.value - avg) < Math.abs(best.value - avg) ? x : best));
      return `<span class="chip">${h(memberShort(m))} ${r.emoji}</span>`;
    }).join('');
    history = `<p class="small">Cooked ${stats.cooked}× · last ${h(fmtDate(stats.lastDate))}</p><div class="chips">${rows}</div>`;
  }

  openSheet(`
    <h2>${PROTEIN_EMOJI[recipe.protein] || ''} ${h(recipe.name)}</h2>
    <div class="badges">${recipeBadges(recipe, { isNew: !stats })}</div>
    ${recipe.tip ? `<p class="tip">🧒 ${h(recipe.tip)}</p>` : ''}
    <div class="row-actions">
      <button data-action="fav" data-id="${h(id)}" class="${fav ? 'on' : ''}">${fav ? '★ Favourite' : '☆ Favourite'}</button>
      <button data-action="block" data-id="${h(id)}" class="${blocked ? 'on warn' : ''}">${blocked ? '🚫 Never suggest' : '🚫 Don\'t suggest'}</button>
      ${day ? `<button data-action="rate" data-day="${dayIndex}">⭐ Rate</button>` : ''}
    </div>
    ${recipe.ingredients.length ? `
    <h3>Ingredients <small class="muted">for ${h(portions.toFixed(1).replace(/\.0$/, ''))} portions</small></h3>
    <ul class="ingredients">${ingredients}</ul>` : ''}
    ${recipe.staples?.length ? `<p class="small muted">From the cupboard: ${h(recipe.staples.join(', '))}</p>` : ''}
    ${recipe.method?.length ? `<h3>Method</h3><ol class="method">${recipe.method.map((s) => `<li>${h(s)}</li>`).join('')}</ol>` : ''}
    <h3>Family verdict</h3>
    ${history}
    ${recipe.custom ? `<div class="row-actions"><button data-action="edit-custom" data-id="${h(id)}">✏️ Edit</button><button data-action="delete-custom" data-id="${h(id)}" class="warn">Delete</button></div>` : ''}
  `);
}

// --- Rating sheet
function openRating(dayIndex) {
  const week = getWeek();
  const day = week.days[dayIndex];
  const recipe = recipesById()[day.recipeId];
  if (!recipe) return;
  const rows = members().filter((m) => day.eaters.includes(m.id)).map((m) => `
    <div class="rate-row">
      <span class="rate-name">${h(m.name)}</span>
      <div class="rate-btns">${RATINGS.map((r) => `
        <button class="${day.ratings?.[m.id] === r.value ? 'on' : ''}" data-action="set-rating" data-day="${dayIndex}" data-member="${h(m.id)}" data-value="${r.value}" aria-label="${h(r.label)}" title="${h(r.label)}">${r.emoji}</button>`).join('')}
      </div>
    </div>`).join('');
  openSheet(`
    <h2>How was it?</h2>
    <p><strong>${h(recipe.name)}</strong> · ${h(fmtDate(day.date, true))}</p>
    <p class="muted small">Each person's verdict counts — if the boys hated it I'll stop suggesting it when they're eating.</p>
    ${rows}
    <button class="primary" data-action="close-sheet">Done</button>
  `);
}

// --- Choose sheet
function openChooser(dayIndex, query = '') {
  const week = getWeek();
  const day = week.days[dayIndex];
  const ctx = planCtx();
  const anyDay = { ...day, slot: 'all' };
  const ranked = rankCandidates(week, anyDay, ctx);
  const q = query.trim().toLowerCase();
  const list = ranked.filter((c) => !q || `${c.recipe.name} ${c.recipe.cuisine} ${c.recipe.protein}`.toLowerCase().includes(q));
  openSheet(`
    <h2>Choose for ${h(fmtDate(day.date, true))}</h2>
    <input type="search" class="search" placeholder="Search meals, cuisines…" value="${h(query)}" data-action="choose-search" data-day="${dayIndex}">
    <p class="muted small">Best matches for who's eating first.</p>
    <ul class="pick-list">
      ${list.map((c) => `
        <li><button data-action="pick" data-day="${dayIndex}" data-id="${h(c.recipe.id)}">
          <span class="emoji">${PROTEIN_EMOJI[c.recipe.protein] || '🍽️'}</span>
          <span class="meal-text"><span class="meal-name">${h(c.recipe.name)}</span>
          <span class="meta">${h(c.recipe.cuisine)} · ${c.recipe.time} min${c.reasons[0] ? ` · ${h(c.reasons[0])}` : ''}</span></span>
        </button></li>`).join('') || '<li class="muted">No matches</li>'}
    </ul>
  `);
}

// --- Shop
function renderShop() {
  $('#title').textContent = 'Shopping list';
  $('#topbar-actions').innerHTML = '';
  const week = getWeek();
  const byId = recipesById();
  const list = buildShoppingList(week, byId, state.settings);
  const checked = week.checked || {};
  const hasMeals = week.days.some((d) => d.recipeId);

  let html = shoppingDayBanner() + weekNav(`Shop on ${fmtDate(shoppingDateFor(ui.weekStart), true)}`);
  if (!hasMeals) {
    html += `<section class="card empty"><p>Plan this week first and the list builds itself.</p>
      <button class="primary" data-action="tab" data-tab="plan">Go to plan</button></section>`;
    view.innerHTML = html;
    return;
  }

  const remaining = list.items.filter((i) => !checked[i.key]).length;
  html += `
    <section class="card">
      <p class="small">Tap <strong>Sainsbury's ↗</strong> on each item to find it on Sainsbury's and add it to your trolley. Tick off what you've added or already have.</p>
      <div class="row-actions">
        <button data-action="share-list">📤 Share list</button>
        <button data-action="reminder">📅 Shopping-day reminder</button>
        <button data-action="clear-ticks">Reset ticks</button>
      </div>
      <form class="add-extra" data-action="add-extra">
        <input name="extra" placeholder="Add something else… (e.g. nappies)" autocomplete="off">
        <button type="submit" class="primary">Add</button>
      </form>
      <p class="muted small">${remaining} of ${list.items.length} items left</p>
    </section>`;

  for (const g of list.groups) {
    const items = g.items.slice().sort((a, b) => Number(!!checked[a.key]) - Number(!!checked[b.key]));
    html += `<section class="card shop-group"><h3>${h(g.category)}</h3><ul class="shop-list">
      ${items.map((i) => `
        <li class="${checked[i.key] ? 'done' : ''}">
          <label>
            <input type="checkbox" data-action="tick" data-key="${h(i.key)}" ${checked[i.key] ? 'checked' : ''}>
            <span><span class="item-name">${h(cap(i.display))}</span>
            <span class="item-meals">${h(i.meals.join(', '))}</span></span>
          </label>
          ${i.extra ? `<button class="icon-btn small" data-action="remove-extra" data-name="${h(i.name)}" aria-label="Remove">✕</button>` : ''}
          <a class="sains" href="${h(i.url)}" target="_blank" rel="noopener">Sainsbury's ↗</a>
        </li>`).join('')}
    </ul></section>`;
  }

  if (list.staples.length) {
    html += `<section class="card shop-group"><h3>Check the cupboard</h3>
      <p class="muted small">Tick anything you're out of to add it to the list.</p>
      <ul class="shop-list staples">
      ${list.staples.map((s) => `
        <li><label><input type="checkbox" data-action="need-staple" data-key="${h(s.key)}" ${week.staplesNeeded?.[s.key] ? 'checked' : ''}>
          <span><span class="item-name">${h(cap(s.name))}</span><span class="item-meals">${h(s.meals.join(', '))}</span></span></label></li>`).join('')}
      </ul></section>`;
  }
  view.innerHTML = html;
}

function shoppingText() {
  const week = getWeek();
  const list = buildShoppingList(week, recipesById(), state.settings);
  const byId = recipesById();
  const meals = week.days.filter((d) => d.recipeId).map((d) => `${DAY_NAMES[parseISODate(d.date).getDay()].slice(0, 3)}: ${byId[d.recipeId]?.name}`);
  return `${listToText(list, `🛒 Shopping list – w/c ${fmtDate(ui.weekStart)}`, week.checked)}\n\n🍽️ MEALS\n${meals.join('\n')}`;
}

// --- Meals library
function renderMeals() {
  $('#title').textContent = 'Meals';
  $('#topbar-actions').innerHTML = `<button class="primary small" data-action="new-custom">+ Add meal</button>`;
  const prof = profile();
  const recipes = allRecipes();
  const cuisines = [...new Set(recipes.map((r) => r.cuisine))].sort();
  const q = ui.mealSearch.toLowerCase();
  const filtered = recipes.filter((r) =>
    (!q || `${r.name} ${r.cuisine}`.toLowerCase().includes(q))
    && (!ui.mealCuisine || r.cuisine === ui.mealCuisine)
    && (!ui.mealProtein || r.protein === ui.mealProtein));

  const rows = filtered
    .map((r) => {
      const s = prof.recipes[r.id];
      const avg = s && s.n ? s.sum / s.n : null;
      return { r, s, avg };
    })
    .sort((a, b) => (b.avg ?? -0.1) - (a.avg ?? -0.1) || a.r.name.localeCompare(b.r.name));

  view.innerHTML = `
    <section class="card filters">
      <input type="search" class="search" placeholder="Search ${recipes.length} meals…" value="${h(ui.mealSearch)}" data-action="meal-search">
      <div class="filter-row">
        <select data-action="meal-cuisine" aria-label="Cuisine"><option value="">All cuisines</option>${cuisines.map((c) => `<option ${c === ui.mealCuisine ? 'selected' : ''}>${h(c)}</option>`).join('')}</select>
        <select data-action="meal-protein" aria-label="Main ingredient"><option value="">All mains</option>${Object.entries(PROTEIN_LABELS).map(([k, v]) => `<option value="${k}" ${k === ui.mealProtein ? 'selected' : ''}>${h(v)}</option>`).join('')}</select>
      </div>
    </section>
    <ul class="meal-list">
      ${rows.map(({ r, s, avg }) => {
        const verdict = avg == null ? '' : RATINGS.reduce((best, x) => (Math.abs(x.value - avg) < Math.abs(best.value - avg) ? x : best)).emoji;
        const flags = [
          state.settings.favourites.includes(r.id) ? '★' : '',
          state.settings.blocked.includes(r.id) ? '🚫' : '',
          r.custom ? '✏️' : '',
        ].join('');
        return `<li><button data-action="open-recipe" data-id="${h(r.id)}">
          <span class="emoji">${PROTEIN_EMOJI[r.protein] || '🍽️'}</span>
          <span class="meal-text"><span class="meal-name">${h(r.name)} ${flags}</span>
          <span class="meta">${h(r.cuisine)}${r.time ? ` · ${r.time} min` : ''}${s ? ` · cooked ${s.cooked}×` : ' · not tried yet'}</span></span>
          <span class="verdict">${verdict}</span>
        </button></li>`;
      }).join('')}
    </ul>`;
}

function openCustomForm(id) {
  const existing = id ? state.customRecipes.find((r) => r.id === id) : null;
  const r = existing || { name: '', cuisine: '', protein: 'chicken', time: 30, kid: true, cheat: false, veg: 1, ingredients: [], staples: [], method: [], tip: '' };
  const cuisines = [...new Set(allRecipes().map((x) => x.cuisine))].sort();
  openSheet(`
    <h2>${existing ? 'Edit meal' : 'Add your own meal'}</h2>
    <form class="custom-form" data-action="save-custom" data-id="${h(id || '')}">
      <label>Name<input name="name" required value="${h(r.name)}" placeholder="e.g. Nan's chicken pie"></label>
      <div class="two">
        <label>Cuisine<input name="cuisine" list="cuisine-list" required value="${h(r.cuisine)}" placeholder="British"></label>
        <label>Main<select name="protein">${Object.entries(PROTEIN_LABELS).map(([k, v]) => `<option value="${k}" ${k === r.protein ? 'selected' : ''}>${h(v)}</option>`).join('')}</select></label>
      </div>
      <datalist id="cuisine-list">${cuisines.map((c) => `<option value="${h(c)}">`).join('')}</datalist>
      <div class="two">
        <label>Time (mins)<input name="time" type="number" min="0" max="600" value="${h(r.time)}"></label>
        <label>Veg portions<input name="veg" type="number" min="0" max="5" step="0.5" value="${h(r.veg)}"></label>
      </div>
      <label class="check"><input type="checkbox" name="kid" ${r.kid ? 'checked' : ''}> The boys like it</label>
      <label class="check"><input type="checkbox" name="cheat" ${r.cheat ? 'checked' : ''}> It's a treat / fakeaway</label>
      <label class="check"><input type="checkbox" name="spicy" ${r.tags?.includes('spicy') ? 'checked' : ''}> Spicy</label>
      <label class="check"><input type="checkbox" name="oily" ${r.tags?.includes('oily-fish') ? 'checked' : ''}> Contains oily fish</label>
      <label class="check"><input type="checkbox" name="red" ${r.tags?.includes('red-meat') ? 'checked' : ''}> Red meat</label>
      <label>Ingredients for the whole family <small class="muted">(one per line, e.g. "600g chicken thighs", "1 tin chopped tomatoes")</small>
        <textarea name="ingredients" rows="6">${h(r.ingredients.join('\n'))}</textarea></label>
      <label>Cupboard staples <small class="muted">(one per line — oil, spices…)</small>
        <textarea name="staples" rows="3">${h((r.staples || []).join('\n'))}</textarea></label>
      <label>Method <small class="muted">(one step per line, optional)</small>
        <textarea name="method" rows="4">${h((r.method || []).join('\n'))}</textarea></label>
      <label>Tip for the boys <small class="muted">(optional)</small><input name="tip" value="${h(r.tip || '')}"></label>
      <button class="primary" type="submit">Save meal</button>
    </form>
  `);
}

function saveCustom(form) {
  const f = new FormData(form);
  const lines = (k) => String(f.get(k) || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const tags = [];
  if (f.get('spicy')) tags.push('spicy');
  if (f.get('oily')) tags.push('oily-fish');
  if (f.get('red')) tags.push('red-meat');
  const id = form.dataset.id || `custom-${String(f.get('name')).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}-${Date.now().toString(36)}`;
  const recipe = {
    id,
    custom: true,
    name: String(f.get('name')).trim(),
    cuisine: String(f.get('cuisine')).trim() || 'Other',
    protein: String(f.get('protein')),
    time: Number(f.get('time')) || 30,
    veg: Number(f.get('veg')) || 0,
    kid: !!f.get('kid'),
    cheat: !!f.get('cheat'),
    tags,
    tip: String(f.get('tip') || '').trim(),
    ingredients: lines('ingredients'),
    staples: lines('staples'),
    method: lines('method'),
  };
  const idx = state.customRecipes.findIndex((r) => r.id === id);
  if (idx >= 0) state.customRecipes[idx] = recipe;
  else state.customRecipes.push(recipe);
  save();
  closeSheet();
  toast('Meal saved');
  render();
}

// --- Settings
const STEPPERS = [
  ['chicken', 'Chicken dinners'],
  ['steak', 'Steak'],
  ['salmon', 'Salmon'],
  ['mince', 'Mince dishes'],
  ['veggie', 'Meat-free'],
  ['cheat', 'Treat nights'],
  ['newMeals', 'New dishes to try'],
];

function daySelect(name, value) {
  return `<select data-setting="${name}">${DAY_NAMES.map((d, i) => `<option value="${i}" ${i === value ? 'selected' : ''}>${d}</option>`).join('')}</select>`;
}

function renderSettings() {
  $('#title').textContent = 'Settings';
  $('#topbar-actions').innerHTML = '';
  const s = state.settings;
  const notifState = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
  view.innerHTML = `
    <section class="card">
      <h3>Household</h3>
      <p class="muted small">Portion sizes scale the shopping list. A 3–5 year old is roughly half an adult portion.</p>
      ${s.members.map((m, i) => `
        <div class="member-row">
          <input value="${h(m.name)}" data-member-index="${i}" data-field="name" aria-label="Name">
          <select data-member-index="${i}" data-field="portion" aria-label="Portion size">
            ${[[1.25, 'Big adult'], [1, 'Adult'], [0.75, 'Older child'], [0.5, 'Young child'], [0.35, 'Toddler']].map(([v, l]) => `<option value="${v}" ${Number(m.portion) === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
          <label class="check small"><input type="checkbox" data-member-index="${i}" data-field="child" ${m.child ? 'checked' : ''}> Child</label>
          ${s.members.length > 1 ? `<button class="icon-btn small" data-action="remove-member" data-index="${i}" aria-label="Remove">✕</button>` : ''}
        </div>`).join('')}
      <button data-action="add-member">+ Add person</button>
    </section>

    <section class="card">
      <h3>Weekly mix</h3>
      <p class="muted small">Dinners per week. Halves mean "every other week" — e.g. mince 0.5.</p>
      ${STEPPERS.map(([k, label]) => `
        <div class="stepper">
          <span>${h(label)}</span>
          <div><button class="icon-btn" data-action="step" data-key="${k}" data-delta="-0.5" aria-label="Less">−</button>
          <strong>${s.mix[k]}</strong>
          <button class="icon-btn" data-action="step" data-key="${k}" data-delta="0.5" aria-label="More">+</button></div>
        </div>`).join('')}
      <label class="check"><input type="checkbox" data-setting="avoidNuts" ${s.avoidNuts ? 'checked' : ''}> Avoid meals with nuts</label>
    </section>

    <section class="card">
      <h3>Days</h3>
      <label class="field">Week starts on ${daySelect('weekStart', s.weekStart)}</label>
      <label class="field">Shopping day ${daySelect('shoppingDay', s.shoppingDay)}</label>
      <label class="field">Treat night ${daySelect('cheatDay', s.cheatDay)}</label>
      <label class="field">Weeknight cooking time
        <select data-setting="weeknightMaxTime">${[20, 30, 40, 50, 60, 90].map((t) => `<option value="${t}" ${t === s.weeknightMaxTime ? 'selected' : ''}>Up to ${t} min</option>`).join('')}</select>
      </label>
    </section>

    <section class="card">
      <h3>Weekly regulars</h3>
      <p class="muted small">Added to every shopping list. One per line.</p>
      <textarea rows="5" data-setting="regulars">${h(s.regulars.join('\n'))}</textarea>
    </section>

    <section class="card">
      <h3>Shopping-day reminder</h3>
      <p class="small">The most reliable reminder is a calendar alert: on the Shop tab tap <strong>📅 Shopping-day reminder</strong> and it adds the list to your phone's calendar with an alert at 9am on ${h(DAY_NAMES[s.shoppingDay])}.</p>
      <p class="small">You can also allow notifications — you'll get one when you open the app on ${h(DAY_NAMES[s.shoppingDay])}. ${notifState === 'unsupported' ? '<br><em>On iPhone, add the app to your Home Screen first.</em>' : ''}</p>
      <button data-action="enable-notifications" ${notifState === 'granted' || notifState === 'unsupported' ? 'disabled' : ''}>
        ${notifState === 'granted' ? '✓ Notifications on' : notifState === 'denied' ? 'Notifications blocked in phone settings' : '🔔 Allow notifications'}
      </button>
    </section>

    <section class="card">
      <h3>Sync with your partner</h3>
      <p class="small">Everything is stored on this phone only. To share:</p>
      <ul class="small">
        <li><strong>Send to partner</strong> (Plan tab) sends this week's plan as a link.</li>
        <li><strong>Backup</strong> exports everything — plans, ratings and your own meals. Importing it on the other phone <em>merges</em> rather than overwrites.</li>
      </ul>
      <div class="row-actions">
        <button data-action="export">⬇️ Export backup</button>
        <label class="button">⬆️ Import backup<input type="file" accept="application/json,.json" data-action="import" hidden></label>
      </div>
    </section>

    <section class="card">
      <h3>Install on your phone</h3>
      <p class="small"><strong>iPhone:</strong> open in Safari → Share → <em>Add to Home Screen</em>.<br>
      <strong>Android:</strong> open in Chrome → ⋮ menu → <em>Install app</em>.</p>
      <p class="muted small">Works offline once installed.</p>
    </section>`;
}

// ------------------------------------------------------------------ actions

function mutateWeek(fn) {
  const week = getWeek(ui.weekStart, true);
  fn(week);
  save();
  render();
}

const actions = {
  tab(el) {
    ui.tab = el.dataset.tab;
    window.scrollTo(0, 0);
    render();
  },
  'week-prev'() {
    ui.weekStart = addDays(ui.weekStart, -7);
    render();
  },
  'week-next'() {
    ui.weekStart = addDays(ui.weekStart, 7);
    render();
  },
  generate() {
    const week = getWeek();
    if (week.days.some((d) => d.recipeId && !d.locked) && !confirm('Re-plan all the unlocked days?')) return;
    state.weeks[ui.weekStart] = generateWeek(week, planCtx());
    save();
    render();
    toast('Week planned — swap anything you don\'t fancy');
  },
  'toggle-eater'(el) {
    mutateWeek((week) => {
      const day = week.days[Number(el.dataset.day)];
      const id = el.dataset.member;
      day.eaters = day.eaters.includes(id) ? day.eaters.filter((x) => x !== id) : [...day.eaters, id];
      day.eaters = members().map((m) => m.id).filter((mid) => day.eaters.includes(mid));
      if (!day.eaters.length) {
        day.recipeId = null;
        day.locked = false;
      }
    });
  },
  lock(el) {
    mutateWeek((week) => {
      const day = week.days[Number(el.dataset.day)];
      day.locked = !day.locked;
    });
  },
  swap(el) {
    mutateWeek((week) => {
      const day = week.days[Number(el.dataset.day)];
      if (!day.eaters.length) day.eaters = members().map((m) => m.id);
      const pick = pickRecipe(week, day, planCtx(), day.recipeId ? [day.recipeId] : []);
      if (pick) day.recipeId = pick.id;
      else toast('No other options — try ☰ Choose');
    });
  },
  choose(el) {
    openChooser(Number(el.dataset.day));
  },
  pick(el) {
    const dayIndex = Number(el.dataset.day);
    mutateWeek((week) => {
      const day = week.days[dayIndex];
      day.recipeId = el.dataset.id;
      day.locked = true;
      if (!day.eaters.length) day.eaters = members().map((m) => m.id);
    });
    closeSheet();
  },
  'clear-day'(el) {
    mutateWeek((week) => {
      const day = week.days[Number(el.dataset.day)];
      day.recipeId = null;
      day.locked = false;
      day.ratings = {};
    });
  },
  'open-recipe'(el) {
    openRecipe(el.dataset.id, el.dataset.day != null ? Number(el.dataset.day) : null);
  },
  rate(el) {
    openRating(Number(el.dataset.day));
  },
  'set-rating'(el) {
    const dayIndex = Number(el.dataset.day);
    const week = getWeek(ui.weekStart, true);
    const day = week.days[dayIndex];
    const value = Number(el.dataset.value);
    day.ratings = day.ratings || {};
    if (day.ratings[el.dataset.member] === value) delete day.ratings[el.dataset.member];
    else day.ratings[el.dataset.member] = value;
    save();
    openRating(dayIndex);
    render();
  },
  fav(el) {
    toggleIn(state.settings.favourites, el.dataset.id);
    save();
    openRecipe(el.dataset.id);
    render();
  },
  block(el) {
    toggleIn(state.settings.blocked, el.dataset.id);
    save();
    openRecipe(el.dataset.id);
    render();
  },
  'close-sheet'() {
    closeSheet();
  },
  async 'share-week'() {
    const week = getWeek();
    const url = weekShareLink(location.origin + location.pathname, week, state.customRecipes);
    const byId = recipesById();
    const lines = week.days.filter((d) => d.recipeId).map((d) => `${DAY_NAMES[parseISODate(d.date).getDay()].slice(0, 3)}: ${byId[d.recipeId]?.name}`);
    await shareOrCopy({ title: 'Meal plan', text: `Meal plan w/c ${fmtDate(week.start)}\n${lines.join('\n')}\n\nOpen to load it into your app:`, url });
  },
  async 'share-list'() {
    await shareOrCopy({ title: 'Shopping list', text: shoppingText() });
  },
  reminder() {
    let dateIso = shoppingDateFor(ui.weekStart);
    const start = parseISODate(dateIso);
    start.setHours(9, 0, 0, 0);
    if (start < new Date()) {
      start.setTime(Date.now() + 5 * 60000);
      dateIso = todayISO();
    }
    const ics = buildICS({
      title: '🛒 Order the Sainsbury\'s shop',
      description: shoppingText(),
      start,
      uid: `shop-${ui.weekStart}@family-meal-planner`,
    });
    download(`shopping-${dateIso}.ics`, ics, 'text/calendar');
    toast('Open the file to add it to your calendar');
  },
  'clear-ticks'() {
    mutateWeek((week) => {
      week.checked = {};
    });
  },
  'remove-extra'(el) {
    mutateWeek((week) => {
      week.extras = week.extras.filter((x) => x !== el.dataset.name);
    });
  },
  'new-custom'() {
    openCustomForm();
  },
  'edit-custom'(el) {
    openCustomForm(el.dataset.id);
  },
  'delete-custom'(el) {
    if (!confirm('Delete this meal?')) return;
    state.customRecipes = state.customRecipes.filter((r) => r.id !== el.dataset.id);
    save();
    closeSheet();
    render();
  },
  'add-member'() {
    state.settings.members.push({ id: `m${Date.now().toString(36)}`, name: 'New person', portion: 1, child: false });
    save();
    render();
  },
  'remove-member'(el) {
    const m = state.settings.members[Number(el.dataset.index)];
    if (!confirm(`Remove ${m.name}?`)) return;
    state.settings.members.splice(Number(el.dataset.index), 1);
    for (const week of Object.values(state.weeks)) {
      for (const day of week.days) day.eaters = day.eaters.filter((id) => id !== m.id);
    }
    save();
    render();
  },
  step(el) {
    const k = el.dataset.key;
    const v = Math.max(0, Math.min(7, state.settings.mix[k] + Number(el.dataset.delta)));
    state.settings.mix[k] = v;
    save();
    render();
  },
  async 'enable-notifications'() {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    state.settings.notifications = result === 'granted';
    save();
    render();
    if (result === 'granted') toast('Notifications on');
  },
  async export() {
    const json = JSON.stringify(state, null, 1);
    const name = `meal-planner-backup-${todayISO()}.json`;
    const file = typeof File !== 'undefined' ? new File([json], name, { type: 'application/json' }) : null;
    if (file && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Meal planner backup' });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    download(name, json, 'application/json');
  },
};

function toggleIn(arr, id) {
  const i = arr.indexOf(id);
  if (i >= 0) arr.splice(i, 1);
  else arr.push(id);
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.tagName === 'FORM' || el.tagName === 'INPUT' || el.tagName === 'SELECT') return;
  const fn = actions[el.dataset.action];
  if (fn) {
    e.preventDefault();
    fn(el);
  }
});

document.querySelector('.tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (!b) return;
  ui.tab = b.dataset.tab;
  window.scrollTo(0, 0);
  render();
});

document.addEventListener('submit', (e) => {
  const form = e.target;
  if (form.dataset.action === 'add-extra') {
    e.preventDefault();
    const value = String(new FormData(form).get('extra') || '').trim();
    if (!value) return;
    mutateWeek((week) => {
      week.extras = [...(week.extras || []).filter((x) => x !== value), value];
    });
  } else if (form.dataset.action === 'save-custom') {
    e.preventDefault();
    saveCustom(form);
  }
});

document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.action === 'meal-search') {
    ui.mealSearch = el.value;
    const pos = el.selectionStart;
    renderMeals();
    const again = $('[data-action="meal-search"]');
    again.focus();
    again.setSelectionRange(pos, pos);
  } else if (el.dataset.action === 'choose-search') {
    openChooser(Number(el.dataset.day), el.value);
    const again = $('[data-action="choose-search"]');
    again.focus();
    again.setSelectionRange(el.value.length, el.value.length);
  }
});

document.addEventListener('change', (e) => {
  const el = e.target;
  const s = state.settings;
  if (el.dataset.action === 'tick') {
    mutateWeek((week) => {
      week.checked = week.checked || {};
      if (el.checked) week.checked[el.dataset.key] = true;
      else delete week.checked[el.dataset.key];
    });
  } else if (el.dataset.action === 'need-staple') {
    mutateWeek((week) => {
      week.staplesNeeded = week.staplesNeeded || {};
      if (el.checked) week.staplesNeeded[el.dataset.key] = true;
      else delete week.staplesNeeded[el.dataset.key];
    });
  } else if (el.dataset.action === 'meal-cuisine') {
    ui.mealCuisine = el.value;
    renderMeals();
  } else if (el.dataset.action === 'meal-protein') {
    ui.mealProtein = el.value;
    renderMeals();
  } else if (el.dataset.action === 'import') {
    importBackup(el.files?.[0]);
  } else if (el.dataset.memberIndex != null) {
    const m = s.members[Number(el.dataset.memberIndex)];
    const f = el.dataset.field;
    if (f === 'name') m.name = el.value.trim() || m.name;
    if (f === 'portion') m.portion = Number(el.value);
    if (f === 'child') m.child = el.checked;
    save();
    render();
  } else if (el.dataset.setting) {
    const k = el.dataset.setting;
    if (k === 'regulars') s.regulars = el.value.split('\n').map((x) => x.trim()).filter(Boolean);
    else if (k === 'avoidNuts') s.avoidNuts = el.checked;
    else s[k] = Number(el.value);
    save();
    if (k === 'weekStart') ui.weekStart = defaultWeekStart();
    render();
  }
});

async function importBackup(file) {
  if (!file) return;
  try {
    const backup = JSON.parse(await file.text());
    if (!backup || typeof backup !== 'object' || !backup.weeks) throw new Error('Not a backup');
    mergeBackup(state, backup);
    save();
    render();
    toast('Backup merged ✓');
  } catch {
    toast('That file isn\'t a meal planner backup');
  }
}

// ------------------------------------------------------------------ startup

function handleShareLink() {
  const payload = readShareHash(location.hash);
  if (!payload || payload.kind !== 'week' || !payload.week?.start) return;
  history.replaceState(null, '', location.pathname + location.search);
  if (confirm(`Load the meal plan for w/c ${fmtDate(payload.week.start)}? It replaces this phone's plan for that week (ratings are kept).`)) {
    applySharedWeek(state, payload, emptyWeek);
    save();
    ui.weekStart = payload.week.start;
    ui.tab = 'plan';
    toast('Plan loaded ✓');
  }
}

async function shoppingDayNotification() {
  const today = todayISO();
  if (parseISODate(today).getDay() !== state.settings.shoppingDay) return;
  if (state.lastNotified === today) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const week = getWeek(defaultWeekStart());
  if (!week.days.some((d) => d.recipeId)) return;
  const n = buildShoppingList(week, recipesById(), state.settings).items.length;
  try {
    const reg = await navigator.serviceWorker?.ready;
    const body = `${n} items for next week's meals. Tap to open the list.`;
    if (reg) await reg.showNotification('🛒 Shopping list ready', { body, tag: 'shopping', icon: 'icons/icon-192.png' });
    else new Notification('🛒 Shopping list ready', { body });
    state.lastNotified = today;
    save();
  } catch {
    // Not fatal: the in-app banner still shows.
  }
}

ui.weekStart = defaultWeekStart();
handleShareLink();
if (new URLSearchParams(location.search).get('tab') === 'shop') ui.tab = 'shop';
render();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(shoppingDayNotification).catch(() => {});
}
