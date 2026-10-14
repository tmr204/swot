import { test } from 'node:test';
import assert from 'node:assert/strict';
import { messageFor } from '../api/cron.js';
import { defaultState, putWeek, weekView } from '../public/js/model.js';

function planned() {
  const s = defaultState();
  const w = weekView(s, '2026-10-20');
  w.days.forEach((d, i) => { d.recipeId = ['chicken-fajitas', 'spag-bol', 'teriyaki-salmon', 'takeaway', 'steak-chips', 'roast-chicken', 'roast-chicken-fried-rice'][i]; });
  putWeek(s, w);
  return s;
}

test('Sunday (order day): shopping list reminder for the coming Tue–Mon', () => {
  const msg = messageFor(planned(), '2026-10-18');
  assert.match(msg.title, /Order/);
  assert.match(msg.body, /items for Tue–Mon/);
  assert.equal(msg.url, '/?tab=shop');
});

test('Saturday: nudge only if next week is not planned', () => {
  assert.equal(messageFor(planned(), '2026-10-17'), null);
  const msg = messageFor(defaultState(), '2026-10-17');
  assert.match(msg.title, /isn't planned/);
  assert.match(msg.body, /closes tomorrow/);
});

test('other days: nothing', () => {
  assert.equal(messageFor(planned(), '2026-10-14'), null);
});
