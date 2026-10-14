# Family Meal Planner

A small app for planning the week's dinners for the four of us. It installs
on iPhone and Android from a web link, works offline, and keeps everything on
the phone. There's no account and no server.

## What it does

- **Plans the week** from a mix you can change in Settings. The default is
  2–3 chicken dinners, a steak, a salmon, mince every other week, a treat
  night on Friday, and one new dish to try. It also balances the week across
  cuisines, keeps long recipes off weeknights and suggests a roast on Sunday.
- **One-off nights.** Tap a person's name on a day to mark them as out. The
  planner then favours quick, kid-friendly meals when it's one parent and the
  boys, and the shopping list scales down to match. If nobody's home, that day
  is left empty.
- **Learns what you like.** After a meal, everyone gives it 😍 👍 😐 or 👎.
  Ratings are kept per person, so a dish the boys refused stops being
  suggested on nights they eat but can still come up on adults-only nights.
  Meals and cuisines you rate highly come back more often. Recently cooked
  meals are rested. You can also ★ favourite a meal or 🚫 block it.
- **Balance check.** Shows oily fish (aim for 1 or more a week), red meat,
  veg per dinner, cuisine variety and treat nights.
- **Shopping list.** Ingredients are merged across the week, scaled to who's
  eating and grouped by aisle. It also includes your weekly regulars and
  anything you add by hand, plus a "check the cupboard" list for staples.
  Each item has a **Sainsbury's ↗** button that opens the search for it.
- **Shopping-day reminder.** 📅 creates a calendar event with an alert at 9am
  on shopping day, with the full list inside it. If notifications are
  allowed, you also get one when you open the app on shopping day.
- **Sharing between phones.** *Send to partner* sends the week as a link.
  *Export/Import backup* merges plans, ratings and custom meals between the
  two phones.
- **Your own meals.** Add family recipes with ingredients in plain text
  (`600g chicken thighs`, `1 tin chopped tomatoes`).

## About Sainsbury's

Sainsbury's has no public API for adding items to a trolley, and its site
blocks automated access. So the app links each item to a Sainsbury's search
instead: tap, add to trolley, tick it off.

## Running it

It's a plain static site with no build step.

```sh
cd meal-planner
npm start            # http://localhost:8080
npm test             # unit tests (Node 20+)
```

To get it onto your phones, it needs to be served over HTTPS once. After
that it works offline.

1. **GitHub Pages:** the workflow in `.github/workflows/meal-planner-pages.yml`
   deploys this folder when it's merged to `master`. One-off setup: go to
   Settings → Pages and set Source to *GitHub Actions*.
2. **Any static host** (Netlify, Vercel, Cloudflare Pages): point it at this
   folder.

Then install it:

- **iPhone:** open the link in Safari → Share → *Add to Home Screen*.
- **Android:** open the link in Chrome → ⋮ → *Install app*.

## Code map

| File | What's in it |
| --- | --- |
| `js/recipes.js` | The meal library (59 meals, 17 cuisines). Quantities are for 3 adult portions. |
| `js/planner.js` | Weekly mix, scoring, learning from ratings, balance check. No DOM. |
| `js/shopping.js` | Ingredient parsing, aisle grouping, merging and scaling, text and calendar export. |
| `js/store.js` | localStorage, share links, backup merge. |
| `js/app.js` | The UI. |
| `sw.js` | Offline cache. |
