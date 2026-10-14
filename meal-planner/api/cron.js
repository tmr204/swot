// Runs every morning (see vercel.json). On each family's shopping day it sends
// the shopping-list reminder; the day before, it nudges if next week isn't planned.

import webpush from 'web-push';
import { RECIPES } from '../public/js/recipes.js';
import { DAY_NAMES, addDays, parseISODate, planningWeekStart, resolveMembers } from '../public/js/planner.js';
import { buildShoppingList } from '../public/js/shopping.js';
import { withDefaultSettings, weekView } from '../public/js/model.js';
import { unflatten } from '../public/js/sync.js';
import { formatPounds } from '../public/js/prices.js';
import { listHouseholds, loadDoc, saveDoc } from '../lib/household.js';

function londonToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(now)
    .reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function messageFor(state, todayIso) {
  const settings = withDefaultSettings(state.settings);
  const today = parseISODate(todayIso);
  const dow = today.getDay();
  const isShopDay = dow === settings.shoppingDay;
  const isDayBefore = dow === (settings.shoppingDay + 6) % 7;
  if (!isShopDay && !isDayBefore) return null;

  // On the day before, the week being shopped for starts after tomorrow's shop.
  const start = planningWeekStart(isShopDay ? today : parseISODate(addDays(todayIso, 1)), settings);
  const week = weekView({ ...state, settings }, start);
  const planned = week.days.filter((d) => d.recipeId).length;
  const endLabel = DAY_NAMES[parseISODate(addDays(start, 6)).getDay()].slice(0, 3);
  const range = `${DAY_NAMES[parseISODate(start).getDay()].slice(0, 3)}–${endLabel}`;

  if (!planned) {
    return {
      title: '🗓️ Next week isn\'t planned yet',
      body: isShopDay ? 'The Sainsbury\'s order closes today — tap to plan the week.' : 'The order closes tomorrow — tap to plan the week.',
      url: '/?tab=plan',
    };
  }
  if (!isShopDay) return null;
  const recipesById = Object.fromEntries([...RECIPES, ...(state.customRecipes || [])].map((r) => [r.id, r]));
  const members = resolveMembers(settings.members, start);
  const list = buildShoppingList(week, recipesById, { members, regulars: settings.regulars });
  const left = list.items.filter((i) => !week.checked[i.key]).length;
  return {
    title: '🛒 Order the Sainsbury\'s shop today',
    body: `${left} items for ${range} · about ${formatPounds(list.totals.total + (settings.budget?.other || 0))}. Tap for the list.`,
    url: '/?tab=shop',
  };
}

export default async function handler(req, res) {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return res.status(200).json({ skipped: 'No VAPID keys' });
  }
  webpush.setVapidDetails('mailto:meal-planner@example.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

  const today = req.query?.date || londonToday();
  const report = [];
  for (const path of await listHouseholds()) {
    const doc = await loadDoc(path);
    const state = unflatten(doc);
    const message = messageFor(state, today);
    if (!message) continue;
    let removed = false;
    for (const [id, sub] of Object.entries(state.push)) {
      try {
        await webpush.sendNotification(sub, JSON.stringify(message), { TTL: 6 * 3600 });
        report.push({ id, ok: true });
      } catch (err) {
        report.push({ id, ok: false, status: err.statusCode });
        if (err.statusCode === 404 || err.statusCode === 410) {
          doc[`push:${id}`] = { v: null, u: Date.now() };
          removed = true;
        }
      }
    }
    if (removed) await saveDoc(path, doc);
  }
  return res.status(200).json({ today, sent: report.length, report });
}
