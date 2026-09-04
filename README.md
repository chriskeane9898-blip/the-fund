# The Fund

A private, no-login dashboard for a six-person group fund — dues, a joint trip vote, a shared ledger, and a live discussion thread. Anyone with the link can view and edit; there are no accounts, by design, so everyone in the group can vote/post without friction.

**Live site:** https://fanciful-licorice-73ae60.netlify.app/

## How it works

- The whole app is a single static page (`index.html`), built from the pieces below.
- Data lives in a [Supabase](https://supabase.com) Postgres table (`fund_state`, one row) with Row Level Security policies that allow public read/update — see `schema.sql`.
- The page talks to Supabase directly from the browser via `supabase-js`, and subscribes to Postgres realtime changes so every open tab updates live, no refresh needed.
- Every edit (vote, ledger change, discussion message) writes immediately — no debounce — so nothing is lost to a quick refresh.
- A daily scheduled job refreshes the market/news ticker by writing to the same row's `market` field only.

## Files

- `index.html` — the built, deployable site (this is what gets dragged onto Netlify).
- `build.py` — assembles `index.html` from the pieces below. Run `python3 build.py` after editing any of them.
- `body_markup.html` — the page's HTML body.
- `style_and_head_extra.html` — CSS and other `<head>` content.
- `logic_supabase.js` — all app logic: rendering, voting, and the Supabase read/write/realtime layer.
- `emblem_b64.txt` — the base64-encoded logo image, spliced into the page at build time.
- `schema.sql` — run this once in the Supabase SQL editor to set up the database (table, RLS policies, realtime, seed data).
- `SETUP.md` — step-by-step deployment guide (Supabase + Netlify).

## Making a change

1. Edit the relevant source file (`body_markup.html`, `style_and_head_extra.html`, or `logic_supabase.js`).
2. Run `python3 build.py` to regenerate `index.html`.
3. Redeploy by dragging the new `index.html` onto the site's Netlify deploy page (same URL, new version).

## Database

Project ref: `htlwzwioybybhxgsnlkc` (Supabase). The site's URL and publishable (anon) key are embedded in `logic_supabase.js` — these are meant to be public; access control is enforced by the RLS policies in `schema.sql`, not by keeping the key secret.
