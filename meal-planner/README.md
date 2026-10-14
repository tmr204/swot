# Family Meal Planner

Plans the week's dinners for Dad, Mum, Ralph and Arlo. It learns what everyone
likes, builds the Sainsbury's shopping list, keeps both phones in sync, and
sends a reminder on Sunday morning before the order closes. It installs on
Android from a link and works offline.

## What it does

- **Weekly plan, Tuesday to Monday.** The shop arrives Tuesday and the order
  closes Sunday. By default each week has 2–3 chicken dinners, a steak, a
  salmon, mince every other week, a Friday treat night and one new dish. You
  can change all of these in Settings. Salmon and steak are planned early in
  the week while they're fresh.
- **Ralph and Arlo.** Ages come from their birthdays, so their portion sizes
  grow with them. "Not keen on" (red onion for both) steers the planner away
  from those dishes without banning them. When a planned meal has a
  not-keen-on ingredient, it shows a hint.
- **One-off nights.** Tap a name on a day to mark that person as out. That
  night then favours quick, kid-friendly meals and the shopping amounts shrink.
- **Learns.** Everyone rates each meal 😍 👍 😐 👎. Ratings are kept per
  person, so a dish the boys refused stops coming up on nights they eat.
- **Budget.** Ingredients are priced from rough Sainsbury's prices and
  rounded up to whole packs. The weekly estimate is shown against the
  £100–£120 budget. If a plan goes over, the priciest flexible meals are
  swapped for cheaper ones.
- **Leftovers and freezer.**
  - A roast is followed by leftover fried rice the next day, chilli by chilli
    jacket potatoes, and bolognese by a pasta bake. The shopping list buys
    extra for the first meal.
  - Tap 🧊 *Make double* on a batch-friendly meal and the second half goes in
    the Freezer tab. The planner then uses one freezer meal a week on a
    weeknight.
- **Shopping list.** Ingredients are merged, scaled to who's eating and
  grouped by aisle. Each item has a **Sainsbury's ↗** search link. The list
  also includes your weekly regulars, anything you add by hand, and a
  "check the cupboard" section for staples.
- **Sync.** One phone taps *Start syncing* and sends an invite link to the
  other. Plans, ratings, ticks, the freezer and settings then stay in step.
- **Reminders.** At about 8am on order day you get a push notification with
  the item count and estimate. The day before, you get a nudge if next week
  isn't planned yet.

Sainsbury's has no public API for filling a trolley, so the app links to a
search for each item instead.

## How it's built

| Path | What |
| --- | --- |
| `public/` | The app: plain HTML, CSS and JS modules with no build step. Installable PWA. |
| `public/js/recipes.js` | 62 meals across 17 cuisines (amounts are for 3 adult portions). |
| `public/js/planner.js` | Weekly mix, scoring, learning, leftovers, freezer, budget. |
| `public/js/shopping.js`, `prices.js` | Shopping list, scaling, aisle grouping, costs. |
| `public/js/sync.js`, `model.js`, `store.js` | State, local storage, sync. |
| `api/sync.js` | Merges a phone's changes into the family's copy (Vercel Blob, private). |
| `api/cron.js` | Daily job that sends the order-day push notifications. |
| `api/config.js` | Gives the app the public push key. |

**How syncing works.** Data is split into small records (one per day, one per
rating, one per ticked item and so on), and each record carries the time it
last changed. The two phones and the server merge by keeping the newer copy
of each record, so you can both edit at once. The family's data lives in one
private Blob file, named after a hash of the family code.

## Running locally

```sh
npm install
npm run dev     # http://localhost:3000 — the sync API runs in memory
npm test
```

## Deploying (Vercel)

1. Create a Vercel project from this repo. No framework preset is needed;
   `vercel.json` sets the output to `public/`.
2. Add a **private** Blob store to the project. This sets
   `BLOB_READ_WRITE_TOKEN`.
3. Set these environment variables:
   - `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`, generated with
     `npx web-push generate-vapid-keys`
   - `CRON_SECRET`, any long random string
4. The daily cron is configured in `vercel.json`. It runs at 07:00 UTC, which
   is 8am in summer and 7am in winter UK time.
