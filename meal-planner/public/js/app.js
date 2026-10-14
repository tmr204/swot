import { RECIPES, PROTEIN_EMOJI, PROTEIN_LABELS, BASE_PORTIONS } from './recipes.js';
import {
  RATINGS, DAY_NAMES, addDays, buildProfile, collectHistory, daysBetween, dinnerBudget, dislikesIn, displayName,
  freezerAvailable, generateWeek, parseISODate, pickRecipe, planningWeekStart, rankCandidates, resolveMembers,
  scoreRecipe, seededRandom, shoppingDateFor, toISODate, weekBalance, weekStartFor,
} from './planner.js';
import { buildICS, buildShoppingList, cap, formatQty, listToText, parseIngredient, portionsFor } from './shopping.js';
import { formatPounds } from './prices.js';
import { claimedFreezerOutside, freezerContents, migrate, putWeek, weekView } from './model.js';
import { flatten, mergeDocs, stamp, unflatten } from './sync.js';
import {
  inviteLink, joinFamily, leaveFamily, loadState, normaliseCode, readJoinHash, saveState, startFamily, syncNow,
} from './store.js';

// ------------------------------------------------------------------ state

const state = loadState();
const ui = {
  tab: 'plan',
  weekStart: null,
  mealSearch: '',
  mealCuisine: '',
  mealProtein: '',
  sync: 'idle', // idle | syncing | ok | error | off
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
  syncSoon();
}

function allRecipes() {
  return [...RECIPES, ...state.customRecipes];
}

function recipesById() {
  return Object.fromEntries(allRecipes().map((r) => [r.id, r]));
}

function profile() {
  return buildProfile(collectHistory(state.days, todayISO()), recipesById());
}

function members(onIso = ui.weekStart || todayISO()) {
  return resolveMembers(state.settings.members, onIso);
}

function getWeek(start = ui.weekStart) {
  return weekView(state, start);
}

function planCtx(week) {
  return {
    recipes: allRecipes(),
    settings: state.settings,
    members: members(week.start),
    profile: profile(),
    rng,
    freezer: state.freezer,
    claimedFreezer: claimedFreezerOutside(state, week),
  };
}

function shopList(week) {
  return buildShoppingList(week, recipesById(), { members: members(week.start), regulars: state.settings.regulars });
}

function fmtDate(iso, long = false) {
  const d = parseISODate(iso);
  const day = DAY_NAMES[d.getDay()];
  const month = d.toLocaleDateString('en-GB', { month: 'short' });
  return `${long ? day : day.slice(0, 3)} ${d.getDate()} ${month}`;
}

function dayShort(iso) {
  return DAY_NAMES[parseISODate(iso).getDay()].slice(0, 3);
}

function memberShort(m) {
  return m.name.split(/\s+/)[0];
}

function joinNames(names) {
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

function eatersLabel(ids) {
  const ms = members();
  if (ids.length === ms.length) return '';
  if (!ids.length) return 'Nobody home';
  return `One-off: ${ms.filter((m) => ids.includes(m.id)).map(memberShort).join(' + ')}`;
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
  if (recipe.tags.includes('batch')) out.push(badge('Freezes well', 'good'));
  if (recipe.tags.includes('nuts')) out.push(badge('Nuts', 'warn'));
  if (isNew) out.push(badge('New to you', 'new'));
  return out.join('');
}

function verdictEmoji(avg) {
  return RATINGS.reduce((best, x) => (Math.abs(x.value - avg) < Math.abs(best.value - avg) ? x : best)).emoji;
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

// ------------------------------------------------------------------ sync

let syncTimer;
let syncing = false;
let syncAgain = false;

function syncSoon(delay = 1500) {
  if (!state.device.syncCode) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(runSync, delay);
}

async function runSync({ quiet = true } = {}) {
  if (!state.device.syncCode) {
    ui.sync = 'off';
    return;
  }
  if (syncing) {
    syncAgain = true;
    return;
  }
  syncing = true;
  setSyncStatus('syncing');
  try {
    const { changed, pending } = await syncNow(state);
    saveState(state);
    setSyncStatus('ok');
    if (changed && !sheet.open) render();
    if (!quiet) toast(changed ? 'Synced — updates from your partner' : 'All up to date');
    if (pending) syncAgain = true;
  } catch {
    setSyncStatus('error');
    if (!quiet) toast('Couldn\'t sync — are you online?');
  } finally {
    syncing = false;
    if (syncAgain) {
      syncAgain = false;
      syncSoon(500);
    }
  }
}

function setSyncStatus(s) {
  ui.sync = s;
  const el = $('#sync-dot');
  if (el) {
    el.dataset.state = s;
    el.title = { syncing: 'Syncing…', ok: 'Synced', error: 'Not synced — offline?', off: 'Sync off' }[s] || '';
  }
}

// ------------------------------------------------------------------ render

function render() {
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === ui.tab));
  const views = { plan: renderPlan, shop: renderShop, freezer: renderFreezer, meals: renderMeals, settings: renderSettings };
  views[ui.tab]();
  setSyncStatus(state.device.syncCode ? ui.sync : 'off');
}

function topbar(title, actions = '') {
  $('#title').textContent = title;
  $('#topbar-actions').innerHTML = `${actions}<span id="sync-dot" class="sync-dot" data-action="sync-now" role="button" aria-label="Sync status"></span>`;
}

function weekNav(label) {
  return `
    <div class="week-nav">
      <button class="icon-btn" data-action="week-prev" aria-label="Previous week">‹</button>
      <div class="week-label"><small>${h(label)}</small><strong>${h(fmtDate(ui.weekStart))} – ${h(fmtDate(addDays(ui.weekStart, 6)))}</strong></div>
      <button class="icon-btn" data-action="week-next" aria-label="Next week">›</button>
    </div>`;
}

function shoppingDayBanner() {
  const today = todayISO();
  const dow = parseISODate(today).getDay();
  const shop = state.settings.shoppingDay;
  if (dow === shop) {
    return `<div class="banner">🛒 The Sainsbury's order closes today — your list is on the <button class="link" data-action="tab" data-tab="shop">Shop</button> tab.</div>`;
  }
  if (dow === (shop + 6) % 7) {
    const next = getWeekFor(planningWeekStart(parseISODate(addDays(today, 1)), state.settings));
    if (!next.days.some((d) => d.recipeId)) return `<div class="banner">🗓️ The order closes tomorrow — time to plan next week.</div>`;
  }
  return '';
}

function getWeekFor(start) {
  return weekView(state, start);
}

function budgetCheck(week) {
  const t = shopList(week).totals;
  const { min, max, other } = state.settings.budget;
  const total = t.total + (other || 0);
  const ok = total <= max;
  return { ok, total, text: `Est. shop ${formatPounds(total)} (budget ${formatPounds(min)}–${formatPounds(max)})` };
}

// --- Plan
function renderPlan() {
  topbar('Meal plan');
  const week = getWeek();
  const byId = recipesById();
  const prof = profile();
  const today = todayISO();
  const hasMeals = week.days.some((d) => d.recipeId);
  const current = weekStartFor(new Date(), state.settings.weekStart);
  const relative = ui.weekStart === current ? 'This week' : daysBetween(current, ui.weekStart) === 7 ? 'Next week' : '';
  const ms = members();

  let html = shoppingDayBanner() + weekNav(relative);

  if (!hasMeals) {
    html += `
      <section class="card empty">
        <p>Nothing planned yet for this week.</p>
        <p class="muted">Tap a name on any day first if someone's out, then let the planner fill the week.</p>
        <button class="primary big" data-action="generate">✨ Plan this week</button>
      </section>`;
  } else {
    const { checks } = weekBalance(week, byId, prof);
    const b = budgetCheck(week);
    html += `
      <section class="card balance">
        <div class="balance-head"><strong>Balance check</strong></div>
        <div class="chips">
          <span class="chip ${b.ok ? 'ok' : 'warn'}">${b.ok ? '✓' : '!'} ${h(b.text)}</span>
          ${checks.map((c) => `<span class="chip ${c.ok ? 'ok' : 'warn'}">${c.ok ? '✓' : '!'} ${h(c.text)}</span>`).join('')}
        </div>
      </section>
      <div class="row-actions">
        <button data-action="generate">↻ Re-plan unlocked</button>
        <button data-action="share-week">📤 Share plan</button>
      </div>`;
  }

  html += week.days.map((day, i) => renderDay(week, day, i, byId, prof, today, ms)).join('');
  html += `<p class="muted center small">🔒 Lock a day to keep it when re-planning. Tap names to say who's eating.</p>`;
  view.innerHTML = html;
}

function renderDay(week, day, index, byId, prof, today, ms) {
  const recipe = byId[day.recipeId];
  const past = day.date < today;
  const isToday = day.date === today;
  const eaterChips = ms.map((m) => `
    <button class="eater ${day.eaters.includes(m.id) ? 'on' : ''}" data-action="toggle-eater" data-day="${index}" data-member="${h(m.id)}"
      aria-pressed="${day.eaters.includes(m.id)}">${h(memberShort(m))}</button>`).join('');
  const oneOff = eatersLabel(day.eaters);
  const eaters = ms.filter((m) => day.eaters.includes(m.id));

  let body;
  let notes = '';
  if (recipe) {
    const picked = week.days.filter((d) => d !== day && d.recipeId).map((d) => ({ date: d.date, recipe: byId[d.recipeId] }));
    const { reasons } = scoreRecipe(recipe, { profile: prof, eaters, date: day.date, settings: state.settings, explore: day.explore, picked });
    let slotNote = reasons[0] || '';
    if (day.slot === 'cheat') slotNote = 'Treat night';
    else if (day.explore) slotNote = 'Something new';
    if (recipe.leftoverOf) slotNote = 'Uses yesterday\'s leftovers';
    if (day.fromFreezer) {
      const item = state.freezer[day.fromFreezer];
      slotNote = `🧊 From the freezer${item ? ` (made ${fmtDate(item.madeOn)})` : ''}`;
    }
    body = `
      <button class="meal" data-action="open-recipe" data-id="${h(recipe.id)}" data-day="${index}">
        <span class="emoji" aria-hidden="true">${day.fromFreezer ? '🧊' : PROTEIN_EMOJI[recipe.protein] || '🍽️'}</span>
        <span class="meal-text">
          <span class="meal-name">${h(recipe.name)}</span>
          <span class="meta">${h(recipe.cuisine)}${recipe.time && !day.fromFreezer ? ` · ${recipe.time} min` : ''}${slotNote ? ` · ${h(slotNote)}` : ''}</span>
        </span>
      </button>`;
    const dislikes = dislikesIn(recipe, eaters);
    if (dislikes.length && !day.fromFreezer) {
      const byTerm = {};
      for (const d of dislikes) (byTerm[d.term] ||= []).push(memberShort(d.member));
      notes += Object.entries(byTerm).map(([term, names]) => `<div class="note">🙅 ${h(joinNames(names))} not keen on ${h(term)} — chop it fine or leave it out of theirs</div>`).join('');
    }
    if (day.double) notes += `<div class="note good">🧊 Cooking double — half goes in the freezer</div>`;
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
        const m = ms.find((x) => x.id === mid);
        const r = RATINGS.find((x) => x.value === v);
        return m && r ? `<span>${h(memberShort(m))} ${r.emoji}</span>` : '';
      }).join('')}</button>`
      : `<button class="rate-cta" data-action="rate" data-day="${index}">How was it? Rate it so I can learn ⭐</button>`;
  }

  const canDouble = recipe && recipe.tags.includes('batch') && !day.fromFreezer;
  return `
    <article class="card day ${isToday ? 'today' : ''} ${past ? 'past' : ''}">
      <div class="day-head">
        <div class="day-date"><strong>${h(dayShort(day.date))}</strong> ${parseISODate(day.date).getDate()}${isToday ? badge('Today', 'today') : ''}</div>
        <div class="eaters" role="group" aria-label="Who's eating">${eaterChips}</div>
      </div>
      ${oneOff ? `<div class="oneoff">${h(oneOff)}</div>` : ''}
      ${body}
      ${notes}
      ${recipe ? `
      <div class="day-actions">
        <button data-action="lock" data-day="${index}" class="${day.locked ? 'on' : ''}" aria-pressed="${day.locked}">${day.locked ? '🔒 Locked' : '🔓 Lock'}</button>
        <button data-action="swap" data-day="${index}">↻ Swap</button>
        <button data-action="choose" data-day="${index}">☰ Choose</button>
        ${canDouble ? `<button data-action="double" data-day="${index}" class="${day.double ? 'on' : ''}" aria-pressed="${!!day.double}">🧊 ${day.double ? 'Double' : 'Make double'}</button>` : ''}
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
  const ms = members();
  const eaterIds = day ? day.eaters : ms.map((m) => m.id);
  let portions = portionsFor(eaterIds, ms);
  if (day?.double) portions *= 2;
  const scale = portions / BASE_PORTIONS;
  const prof = profile();
  const stats = prof.recipes[id];
  const fav = state.settings.favourites.includes(id);
  const blocked = state.settings.blocked.includes(id);
  const dislikes = dislikesIn(recipe, ms.filter((m) => eaterIds.includes(m.id)));

  const ingredients = recipe.ingredients.map((line) => {
    const ing = parseIngredient(line);
    if (ing.qty == null) return `<li>${h(cap(ing.name))}</li>`;
    const qty = ing.unit === 'g' || ing.unit === 'ml' ? Math.round(ing.qty * scale / 5) * 5 : +(ing.qty * scale).toFixed(1);
    return `<li>${h(cap(formatQty(qty, ing.unit, ing.name)))}</li>`;
  }).join('');

  let history = '<p class="muted small">Not cooked yet.</p>';
  if (stats) {
    const rows = ms.map((m) => {
      const s = stats.byMember[m.id];
      return s ? `<span class="chip">${h(memberShort(m))} ${verdictEmoji(s.sum / s.n)}</span>` : '';
    }).join('');
    history = `<p class="small">Cooked ${stats.cooked}× · last ${h(fmtDate(stats.lastDate))}</p><div class="chips">${rows}</div>`;
  }

  openSheet(`
    <h2>${PROTEIN_EMOJI[recipe.protein] || ''} ${h(recipe.name)}</h2>
    <div class="badges">${recipeBadges(recipe, { isNew: !stats })}</div>
    ${recipe.tip ? `<p class="tip">🧒 ${h(recipe.tip)}</p>` : ''}
    ${dislikes.map((d) => `<p class="tip warn">🙅 ${h(d.member.name)} isn't keen on ${h(d.term)}.</p>`).join('')}
    <div class="row-actions">
      <button data-action="fav" data-id="${h(id)}" class="${fav ? 'on' : ''}">${fav ? '★ Favourite' : '☆ Favourite'}</button>
      <button data-action="block" data-id="${h(id)}" class="${blocked ? 'on warn' : ''}">${blocked ? '🚫 Never suggest' : '🚫 Don\'t suggest'}</button>
      ${day ? `<button data-action="rate" data-day="${dayIndex}">⭐ Rate</button>` : ''}
    </div>
    ${day?.fromFreezer ? '<p class="tip">🧊 This one\'s coming out of the freezer — defrost it in the fridge the night before.</p>' : ''}
    ${recipe.ingredients.length && !day?.fromFreezer ? `
    <h3>Ingredients <small class="muted">for ${h(portions.toFixed(1).replace(/\.0$/, ''))} portions${day?.double ? ' (double batch)' : ''}</small></h3>
    <ul class="ingredients">${ingredients}</ul>` : ''}
    ${recipe.staples?.length && !day?.fromFreezer ? `<p class="small muted">From the cupboard: ${h(recipe.staples.join(', '))}</p>` : ''}
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
    <p class="muted small">Everyone's verdict counts. If the boys hated it, I'll stop suggesting it on nights they're eating.</p>
    ${rows}
    <button class="primary" data-action="close-sheet">Done</button>
  `);
}

// --- Choose sheet
function openChooser(dayIndex, query = '') {
  const week = getWeek();
  const day = week.days[dayIndex];
  const ctx = planCtx(week);
  const ranked = rankCandidates(week, { ...day, slot: 'all' }, ctx);
  const q = query.trim().toLowerCase();
  const list = ranked.filter((c) => !q || `${c.recipe.name} ${c.recipe.cuisine} ${c.recipe.protein}`.toLowerCase().includes(q));
  const byId = recipesById();
  const claimed = new Set([...ctx.claimedFreezer, ...week.days.filter((d) => d !== day && d.fromFreezer).map((d) => d.fromFreezer)]);
  const frozen = freezerAvailable(state.freezer, claimed, day.date).filter((f) => byId[f.recipeId]);
  openSheet(`
    <h2>Choose for ${h(fmtDate(day.date, true))}</h2>
    ${frozen.length && !q ? `
      <h3>🧊 From the freezer</h3>
      <ul class="pick-list">${frozen.map((f) => `
        <li><button data-action="pick-freezer" data-day="${dayIndex}" data-id="${h(f.id)}">
          <span class="emoji">🧊</span>
          <span class="meal-text"><span class="meal-name">${h(byId[f.recipeId].name)}</span>
          <span class="meta">Made ${h(fmtDate(f.madeOn))} · no shopping needed</span></span>
        </button></li>`).join('')}</ul>
      <h3>Cook something</h3>` : ''}
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
  topbar('Shopping list');
  const week = getWeek();
  const list = shopList(week);
  const checked = week.checked || {};
  const hasMeals = week.days.some((d) => d.recipeId);

  let html = shoppingDayBanner() + weekNav(`Order by ${fmtDate(shoppingDateFor(ui.weekStart, state.settings), true)}`);
  if (!hasMeals) {
    html += `<section class="card empty"><p>Plan this week first and the list builds itself.</p>
      <button class="primary" data-action="tab" data-tab="plan">Go to plan</button></section>`;
    view.innerHTML = html;
    return;
  }

  const { min, max, other } = state.settings.budget;
  const t = list.totals;
  const total = t.total + (other || 0);
  const pct = Math.min(100, (total / max) * 100);
  const remaining = list.items.filter((i) => !checked[i.key]).length;
  html += `
    <section class="card budget ${total > max ? 'over' : ''}">
      <div class="budget-head"><strong>Est. ${formatPounds(total)}</strong><span class="muted small">budget ${formatPounds(min)}–${formatPounds(max)}</span></div>
      <div class="meter" role="meter" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${total.toFixed(0)}"><span style="width:${pct}%"></span></div>
      <p class="small muted">Dinners ${formatPounds(t.dinners)} · regulars ${formatPounds(t.regulars)}${t.extras + t.staples ? ` · extras ${formatPounds(t.extras + t.staples)}` : ''} · everything else ${formatPounds(other || 0)}</p>
      <p class="small muted">Rough Sainsbury's prices — a guide, not the till total.</p>
    </section>
    <section class="card">
      <p class="small">Tap <strong>Sainsbury's ↗</strong> on each item to find it and add it to your trolley. Tick off what you've added or already have.</p>
      <div class="row-actions">
        <button data-action="share-list">📤 Share list</button>
        <button data-action="reminder">📅 Calendar reminder</button>
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
            <span class="item-meals">${i.cost ? `~${formatPounds(i.cost)} · ` : ''}${h(i.meals.join(', '))}</span></span>
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
  const list = shopList(week);
  const byId = recipesById();
  const meals = week.days.filter((d) => d.recipeId).map((d) => `${dayShort(d.date)}: ${byId[d.recipeId]?.name}${d.fromFreezer ? ' (freezer)' : ''}`);
  return `${listToText(list, `🛒 Shopping list – ${fmtDate(ui.weekStart)} to ${fmtDate(addDays(ui.weekStart, 6))}`, week.checked)}\n\n🍽️ MEALS\n${meals.join('\n')}`;
}

// --- Freezer
function renderFreezer() {
  topbar('Freezer', '<button class="primary small" data-action="add-freezer">+ Add</button>');
  const today = todayISO();
  const byId = recipesById();
  const items = freezerContents(state, today);
  view.innerHTML = `
    <section class="card">
      <p class="small">Batch-cook to save money and time: on the plan, tap <strong>🧊 Make double</strong> on meals like chilli, bolognese or curry. Half goes in here, and the planner uses it on a busy weeknight.</p>
      <p class="small muted">Freezer nights per week: ${state.settings.mix.freezer} (change in Settings).</p>
    </section>
    ${items.length ? `<ul class="freezer-list">${items.map((f) => {
      const r = byId[f.recipeId];
      const age = daysBetween(f.madeOn, today);
      const status = !f.ready ? `Being cooked ${fmtDate(f.madeOn)}` : f.plannedFor ? `Planned for ${fmtDate(f.plannedFor)}` : `In since ${fmtDate(f.madeOn)}${age > 90 ? ' — use soon!' : ''}`;
      return `<li class="freezer-row">
        <span class="emoji">🧊</span>
        <span class="meal-text"><span class="meal-name">${h(r?.name || f.note || 'Something tasty')}</span>
        <span class="meta">${h(status)}${f.note && r ? ` · ${h(f.note)}` : ''}</span></span>
        <button class="small" data-action="freezer-used" data-id="${h(f.id)}">Used / binned</button>
      </li>`;
    }).join('')}</ul>` : '<section class="card empty"><p>The freezer is empty.</p><p class="muted small">Add anything that\'s already in there so the planner can use it.</p></section>'}
  `;
}

function openFreezerForm() {
  const recipes = allRecipes().filter((r) => !r.cheat && r.ingredients.length).sort((a, b) => a.name.localeCompare(b.name));
  const batch = recipes.filter((r) => r.tags.includes('batch'));
  openSheet(`
    <h2>Add to the freezer</h2>
    <form class="custom-form" data-action="save-freezer">
      <label>What is it?
        <select name="recipeId" required>
          <optgroup label="Freezes well">${batch.map((r) => `<option value="${h(r.id)}">${h(r.name)}</option>`).join('')}</optgroup>
          <optgroup label="Everything else">${recipes.filter((r) => !batch.includes(r)).map((r) => `<option value="${h(r.id)}">${h(r.name)}</option>`).join('')}</optgroup>
        </select>
      </label>
      <label>Frozen on<input type="date" name="madeOn" value="${todayISO()}" max="${todayISO()}" required></label>
      <label>Note <small class="muted">(optional, e.g. "2 adult portions")</small><input name="note"></label>
      <button class="primary" type="submit">Add</button>
    </form>`);
}

// --- Meals library
function renderMeals() {
  topbar('Meals', '<button class="primary small" data-action="new-custom">+ Add meal</button>');
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
        const flags = [
          state.settings.favourites.includes(r.id) ? '★' : '',
          state.settings.blocked.includes(r.id) ? '🚫' : '',
          r.custom ? '✏️' : '',
        ].join('');
        return `<li><button data-action="open-recipe" data-id="${h(r.id)}">
          <span class="emoji">${PROTEIN_EMOJI[r.protein] || '🍽️'}</span>
          <span class="meal-text"><span class="meal-name">${h(r.name)} ${flags}</span>
          <span class="meta">${h(r.cuisine)}${r.time ? ` · ${r.time} min` : ''}${s ? ` · cooked ${s.cooked}×` : ' · not tried yet'}</span></span>
          <span class="verdict">${avg == null ? '' : verdictEmoji(avg)}</span>
        </button></li>`;
      }).join('')}
    </ul>`;
}

function openCustomForm(id) {
  const existing = id ? state.customRecipes.find((r) => r.id === id) : null;
  const r = existing || { name: '', cuisine: '', protein: 'chicken', time: 30, kid: true, cheat: false, veg: 1, ingredients: [], staples: [], method: [], tip: '', tags: [] };
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
      <label class="check"><input type="checkbox" name="batch" ${r.tags?.includes('batch') ? 'checked' : ''}> Freezes well</label>
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
  if (f.get('batch')) tags.push('batch');
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
  ['freezer', 'Freezer nights'],
];
const PORTIONS = [['auto', 'Auto (by age)'], [1.25, 'Big adult'], [1, 'Adult'], [0.75, 'Older child'], [0.6, 'Child'], [0.5, 'Young child'], [0.35, 'Toddler']];

function daySelect(name, value) {
  return `<select data-setting="${name}">${DAY_NAMES.map((d, i) => `<option value="${i}" ${i === value ? 'selected' : ''}>${d}</option>`).join('')}</select>`;
}

function renderSettings() {
  topbar('Settings');
  const s = state.settings;
  const resolved = members(todayISO());
  const code = state.device.syncCode;
  const pushOn = state.device.pushId && state.push[state.device.pushId];
  const pushCount = Object.keys(state.push).length;
  const notifState = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
  view.innerHTML = `
    <section class="card">
      <h3>Sync between your phones</h3>
      ${code ? `
        <p class="small">This phone is synced. Your family code:</p>
        <p class="code">${h(code)}</p>
        <p class="muted small">${state.device.lastSync ? `Last synced ${h(new Date(state.device.lastSync).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' }))}` : 'Not synced yet'}</p>
        <div class="row-actions">
          <button data-action="invite">📤 Invite your partner</button>
          <button data-action="sync-now">↻ Sync now</button>
          <button data-action="leave-family" class="warn">Stop syncing</button>
        </div>` : `
        <p class="small">Plans, ratings, ticks and the freezer stay in step on both phones.</p>
        <div class="row-actions"><button class="primary" data-action="start-family">Start syncing</button></div>
        <form class="add-extra" data-action="join-family">
          <input name="code" placeholder="Or enter a family code" autocomplete="off" autocapitalize="characters">
          <button type="submit">Join</button>
        </form>`}
    </section>

    <section class="card">
      <h3>Reminders</h3>
      <p class="small">A notification at about 8am on ${h(DAY_NAMES[s.shoppingDay])} with the shopping list, plus a nudge on ${h(DAY_NAMES[(s.shoppingDay + 6) % 7])} if next week isn't planned yet.</p>
      ${code ? `
        <button data-action="${pushOn ? 'disable-push' : 'enable-push'}" ${notifState === 'unsupported' || (notifState === 'denied' && !pushOn) ? 'disabled' : ''}>
          ${pushOn ? '🔕 Turn off on this phone' : notifState === 'denied' ? 'Notifications blocked in phone settings' : '🔔 Turn on for this phone'}
        </button>
        <p class="muted small">${pushCount} phone${pushCount === 1 ? '' : 's'} getting reminders.</p>` : '<p class="muted small">Turn on syncing first — reminders come from the same service.</p>'}
    </section>

    <section class="card">
      <h3>Household</h3>
      <p class="muted small">Birthdays keep the boys' ages and portion sizes up to date. "Not keen on" steers away from things gently — it doesn't rule meals out.</p>
      ${s.members.map((m, i) => {
        const r = resolved[i];
        return `
        <div class="member">
          <div class="member-row">
            <input value="${h(m.name)}" data-member-index="${i}" data-field="name" aria-label="Name">
            <input type="date" value="${h(m.dob || '')}" data-member-index="${i}" data-field="dob" aria-label="Birthday">
            ${s.members.length > 1 ? `<button class="icon-btn small" data-action="remove-member" data-index="${i}" aria-label="Remove">✕</button>` : ''}
          </div>
          <div class="member-row">
            <select data-member-index="${i}" data-field="portion" aria-label="Portion size">
              ${PORTIONS.map(([v, l]) => `<option value="${v}" ${String(m.portion ?? 'auto') === String(v) ? 'selected' : ''}>${l}${v === 'auto' ? ` — ${r.portion}` : ''}</option>`).join('')}
            </select>
            <input value="${h((m.dislikes || []).join(', '))}" data-member-index="${i}" data-field="dislikes" placeholder="Not keen on…" aria-label="Not keen on">
          </div>
          <p class="muted small">${h(displayName(r))}${r.child ? ' · child' : ''}</p>
        </div>`;
      }).join('')}
      <button data-action="add-member">+ Add person</button>
    </section>

    <section class="card">
      <h3>Weekly budget</h3>
      <div class="two">
        <label class="field">From £<input type="number" min="0" step="5" value="${s.budget.min}" data-budget="min"></label>
        <label class="field">To £<input type="number" min="0" step="5" value="${s.budget.max}" data-budget="max"></label>
      </div>
      <label class="field">Everything else (lunches, snacks, toiletries) £<input type="number" min="0" step="5" value="${s.budget.other}" data-budget="other"></label>
      <p class="muted small">That leaves about ${formatPounds(Math.max(0, dinnerBudget(s)))} for dinners after your regulars. If a week's plan goes over, the planner swaps the priciest flexible meals for cheaper ones.</p>
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
      <label class="check"><input type="checkbox" data-setting="leftovers" ${s.leftovers ? 'checked' : ''}> Plan leftover meals (e.g. roast → fried rice the next day)</label>
      <label class="check"><input type="checkbox" data-setting="avoidNuts" ${s.avoidNuts ? 'checked' : ''}> Avoid meals with nuts</label>
    </section>

    <section class="card">
      <h3>Days</h3>
      <label class="field">Week starts (delivery day) ${daySelect('weekStart', s.weekStart)}</label>
      <label class="field">Order deadline ${daySelect('shoppingDay', s.shoppingDay)}</label>
      <label class="field">Treat night ${daySelect('cheatDay', s.cheatDay)}</label>
      <label class="field">Weeknight cooking time
        <select data-setting="weeknightMaxTime">${[20, 30, 40, 50, 60, 90].map((t) => `<option value="${t}" ${t === s.weeknightMaxTime ? 'selected' : ''}>Up to ${t} min</option>`).join('')}</select>
      </label>
    </section>

    <section class="card">
      <h3>Weekly regulars</h3>
      <p class="muted small">Added to every shopping list. One per line; "Milk x2" for two.</p>
      <textarea rows="6" data-setting="regulars">${h(s.regulars.join('\n'))}</textarea>
    </section>

    <section class="card">
      <h3>Backup</h3>
      <div class="row-actions">
        <button data-action="export">⬇️ Export backup</button>
        <label class="button">⬆️ Import backup<input type="file" accept="application/json,.json" data-action="import" hidden></label>
      </div>
    </section>

    <section class="card">
      <h3>Install on your phone</h3>
      <p class="small">Open the link in Chrome → ⋮ menu → <em>Install app</em> (or <em>Add to Home screen</em>).</p>
      <p class="muted small">Works offline once installed; syncs when you're back online.</p>
    </section>`;
}

// ------------------------------------------------------------------ push

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function enablePush() {
  try {
    const config = await (await fetch('/api/config')).json();
    if (!config.vapidPublicKey) throw new Error('Push not set up on the server');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      toast('Notifications weren\'t allowed');
      render();
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey) });
    const id = state.device.pushId || `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    state.device.pushId = id;
    state.push[id] = { ...sub.toJSON(), added: todayISO() };
    save();
    render();
    toast('Reminders on 🔔');
  } catch (err) {
    toast(`Couldn't turn on reminders: ${err.message}`);
  }
}

async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    await sub?.unsubscribe();
  } catch {
    // Still remove it from the family list below.
  }
  delete state.push[state.device.pushId];
  state.device.pushId = null;
  save();
  render();
}

// ------------------------------------------------------------------ actions

function mutateWeek(fn) {
  const week = getWeek();
  fn(week);
  putWeek(state, week);
  save();
  render();
}

function allMemberIds() {
  return state.settings.members.map((m) => m.id);
}

function setDouble(day, on) {
  const id = `fz-${day.date}`;
  day.double = on;
  if (on) state.freezer[id] = { id, recipeId: day.recipeId, madeOn: day.date, note: 'Second batch' };
  else delete state.freezer[id];
}

function clearDayExtras(day) {
  if (day.double) setDouble(day, false);
  delete day.fromFreezer;
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
    for (const d of week.days) if (!d.locked && d.double) setDouble(d, false);
    putWeek(state, generateWeek(week, planCtx(week)));
    save();
    render();
    toast('Week planned — swap anything you don\'t fancy');
  },
  'toggle-eater'(el) {
    mutateWeek((week) => {
      const day = week.days[Number(el.dataset.day)];
      const id = el.dataset.member;
      const set = new Set(day.eaters);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      day.eaters = allMemberIds().filter((mid) => set.has(mid));
      if (!day.eaters.length) {
        clearDayExtras(day);
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
  double(el) {
    mutateWeek((week) => {
      const day = week.days[Number(el.dataset.day)];
      setDouble(day, !day.double);
      toast(day.double ? 'Double batch — the extra goes in the freezer' : 'Back to a single batch');
    });
  },
  swap(el) {
    mutateWeek((week) => {
      const day = week.days[Number(el.dataset.day)];
      if (!day.eaters.length) day.eaters = allMemberIds();
      const exclude = day.recipeId ? [day.recipeId] : [];
      clearDayExtras(day);
      if (day.slot === 'freezer' || day.slot === 'leftover') day.slot = null;
      const pick = pickRecipe(week, day, planCtx(week), exclude);
      if (pick) day.recipeId = pick.id;
      else toast('No other options — try ☰ Choose');
    });
  },
  choose(el) {
    openChooser(Number(el.dataset.day));
  },
  pick(el) {
    mutateWeek((week) => {
      const day = week.days[Number(el.dataset.day)];
      clearDayExtras(day);
      day.recipeId = el.dataset.id;
      day.slot = null;
      day.locked = true;
      if (!day.eaters.length) day.eaters = allMemberIds();
    });
    closeSheet();
  },
  'pick-freezer'(el) {
    const item = state.freezer[el.dataset.id];
    mutateWeek((week) => {
      const day = week.days[Number(el.dataset.day)];
      clearDayExtras(day);
      day.fromFreezer = item.id;
      day.recipeId = item.recipeId;
      day.slot = 'freezer';
      day.locked = true;
      if (!day.eaters.length) day.eaters = allMemberIds();
    });
    closeSheet();
  },
  'clear-day'(el) {
    mutateWeek((week) => {
      const day = week.days[Number(el.dataset.day)];
      clearDayExtras(day);
      day.recipeId = null;
      day.slot = null;
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
    const week = getWeek();
    const day = week.days[dayIndex];
    const value = Number(el.dataset.value);
    day.ratings = day.ratings || {};
    if (day.ratings[el.dataset.member] === value) delete day.ratings[el.dataset.member];
    else day.ratings[el.dataset.member] = value;
    putWeek(state, week);
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
    const byId = recipesById();
    const lines = week.days.filter((d) => d.recipeId).map((d) => `${dayShort(d.date)}: ${byId[d.recipeId]?.name}`);
    await shareOrCopy({ title: 'Meal plan', text: `🍽️ Dinners ${fmtDate(week.start)} – ${fmtDate(addDays(week.start, 6))}\n${lines.join('\n')}` });
  },
  async 'share-list'() {
    await shareOrCopy({ title: 'Shopping list', text: shoppingText() });
  },
  reminder() {
    let dateIso = shoppingDateFor(ui.weekStart, state.settings);
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
  'add-freezer'() {
    openFreezerForm();
  },
  'freezer-used'(el) {
    const id = el.dataset.id;
    const plannedDay = Object.values(state.days).find((d) => d.fromFreezer === id && d.date > todayISO());
    if (plannedDay && !confirm(`It's planned for ${fmtDate(plannedDay.date)} — remove it from the plan too?`)) return;
    if (plannedDay) {
      delete plannedDay.fromFreezer;
      plannedDay.recipeId = null;
      plannedDay.slot = null;
      plannedDay.locked = false;
    }
    delete state.freezer[id];
    const source = Object.values(state.days).find((d) => `fz-${d.date}` === id);
    if (source) source.double = false;
    save();
    render();
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
    state.settings.members.push({ id: `m${Date.now().toString(36)}`, name: 'New person', portion: 'auto', dislikes: [] });
    save();
    render();
  },
  'remove-member'(el) {
    const m = state.settings.members[Number(el.dataset.index)];
    if (!confirm(`Remove ${m.name}?`)) return;
    state.settings.members.splice(Number(el.dataset.index), 1);
    for (const day of Object.values(state.days)) day.eaters = day.eaters.filter((id) => id !== m.id);
    save();
    render();
  },
  step(el) {
    const k = el.dataset.key;
    state.settings.mix[k] = Math.max(0, Math.min(7, (state.settings.mix[k] || 0) + Number(el.dataset.delta)));
    save();
    render();
  },
  'start-family'() {
    startFamily(state);
    saveState(state);
    runSync({ quiet: false }).then(render);
    render();
  },
  async invite() {
    const url = inviteLink(location.origin + location.pathname, state.device.syncCode);
    await shareOrCopy({ title: 'Family meal planner', text: 'Join our meal planner so we share the plan and shopping list. Open this on your phone:', url });
  },
  'sync-now'() {
    if (!state.device.syncCode) {
      ui.tab = 'settings';
      render();
      return;
    }
    runSync({ quiet: false });
  },
  'leave-family'() {
    if (!confirm('Stop syncing this phone? Your plans stay on this phone, but changes won\'t reach your partner.')) return;
    if (state.device.pushId) {
      delete state.push[state.device.pushId];
      state.device.pushId = null;
    }
    runSync().finally(() => {
      leaveFamily(state);
      saveState(state);
      render();
    });
  },
  'enable-push'() {
    enablePush();
  },
  'disable-push'() {
    disablePush();
  },
  async export() {
    const { syncDoc, ...rest } = state;
    const json = JSON.stringify({ ...rest, device: {} }, null, 1);
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
  const action = form.dataset.action;
  if (!action) return;
  e.preventDefault();
  const f = new FormData(form);
  if (action === 'add-extra') {
    const value = String(f.get('extra') || '').trim();
    if (!value) return;
    mutateWeek((week) => {
      week.extras = [...(week.extras || []).filter((x) => x !== value), value];
    });
  } else if (action === 'save-custom') {
    saveCustom(form);
  } else if (action === 'save-freezer') {
    const id = `fz-m${Date.now().toString(36)}`;
    state.freezer[id] = { id, recipeId: String(f.get('recipeId')), madeOn: String(f.get('madeOn')), note: String(f.get('note') || '').trim() };
    save();
    closeSheet();
    render();
    toast('Added to the freezer');
  } else if (action === 'join-family') {
    const code = normaliseCode(f.get('code'));
    if (!code) {
      toast('That code doesn\'t look right — it\'s 12 letters and numbers');
      return;
    }
    joinFamily(state, code);
    saveState(state);
    runSync({ quiet: false }).then(render);
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
      if (el.checked) week.checked[el.dataset.key] = true;
      else delete week.checked[el.dataset.key];
    });
  } else if (el.dataset.action === 'need-staple') {
    mutateWeek((week) => {
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
    if (f === 'dob') m.dob = el.value || undefined;
    if (f === 'portion') m.portion = el.value === 'auto' ? 'auto' : Number(el.value);
    if (f === 'dislikes') m.dislikes = el.value.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
    save();
    render();
  } else if (el.dataset.budget) {
    s.budget[el.dataset.budget] = Math.max(0, Number(el.value) || 0);
    save();
    render();
  } else if (el.dataset.setting) {
    const k = el.dataset.setting;
    if (k === 'regulars') s.regulars = el.value.split('\n').map((x) => x.trim()).filter(Boolean);
    else if (k === 'avoidNuts' || k === 'leftovers') s[k] = el.checked;
    else s[k] = Number(el.value);
    save();
    if (k === 'weekStart' || k === 'shoppingDay') ui.weekStart = planningWeekStart(new Date(), s);
    render();
  }
});

async function importBackup(file) {
  if (!file) return;
  try {
    const raw = JSON.parse(await file.text());
    if (!raw || typeof raw !== 'object' || !(raw.days || raw.weeks)) throw new Error('Not a backup');
    const incoming = migrate(raw);
    const now = Date.now();
    // Treat the backup as older than anything on this phone: it fills gaps
    // and brings back ratings, but doesn't overwrite newer changes.
    const merged = mergeDocs(stamp(flatten(incoming), {}, 0), stamp(flatten(state), state.syncDoc || {}, now));
    state.syncDoc = {};
    const shared = unflatten(merged);
    Object.assign(state, { ...shared, settings: shared.settings || state.settings });
    save();
    render();
    toast('Backup merged ✓');
  } catch {
    toast('That file isn\'t a meal planner backup');
  }
}

// ------------------------------------------------------------------ startup

function handleJoinLink() {
  const code = readJoinHash(location.hash);
  if (!code) return;
  history.replaceState(null, '', location.pathname + location.search);
  if (state.device.syncCode === code) return;
  if (confirm('Join your family\'s meal planner? This phone will share plans, ratings and the shopping list with the other phone.')) {
    joinFamily(state, code);
    saveState(state);
    ui.tab = 'plan';
    toast('Joining…');
  }
}

ui.weekStart = planningWeekStart(new Date(), state.settings);
handleJoinLink();
const params = new URLSearchParams(location.search);
if (['shop', 'plan', 'freezer', 'meals', 'settings'].includes(params.get('tab'))) ui.tab = params.get('tab');
render();
runSync();

window.addEventListener('hashchange', () => {
  if (!readJoinHash(location.hash)) return;
  handleJoinLink();
  render();
  runSync({ quiet: false });
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') runSync();
});
setInterval(() => {
  if (document.visibilityState === 'visible') runSync();
}, 60000);
window.addEventListener('online', () => runSync());

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
