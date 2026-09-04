# The Fund — going live as a real site

This is the same dashboard (same design, same data), rebuilt to run outside Claude with its own real database — so everyone can vote and post with no login and no editing-permissions problem. It's about 10 minutes of setup, all free, no credit card.

## What you're setting up

- **Supabase** — a free hosted database. Holds all the fund data and pushes live updates to every open tab.
- **Netlify** (or Cloudflare Pages) — free static hosting. Turns `index.html` into a real public URL you can text to the group.

I can't create these accounts for you — they need your login — but everything else is done: the site, the design, the database schema, all pre-loaded with your current numbers.

## Step 1 — Create the database (Supabase)

1. Go to supabase.com and sign up free (GitHub or email, no card).
2. Create a new project (pick any name/region; set any database password — you won't need it again).
3. Once it's ready, open the **SQL Editor** (left sidebar) → **New query**.
4. Open `schema.sql` (included here), paste its entire contents in, and click **Run**.
   This creates the table, opens it up for anyone to read/vote, turns on live sync, and seeds it with your current fund numbers, ledger, and market ticker.
5. Go to **Project Settings → API**. Copy two values:
   - **Project URL** (looks like `https://xxxxxxxx.supabase.co`)
   - **anon public** key (a long string — this one's *meant* to be public)

Send me those two values and I'll drop them into `index.html` for you. (Or do it yourself: open `index.html`, find `__SUPABASE_URL__` and `__SUPABASE_ANON_KEY__` near the top of the `<script>` block, and replace them.)

## Step 2 — Put it online (Netlify)

Easiest path, no account required to start:

1. Go to **app.netlify.com/drop**
2. Drag `index.html` onto the page.
3. Netlify gives you a live URL immediately (something like `thefund-xyz123.netlify.app`).

That's it — that URL is what you send to the group chat. If you want it to stop being random letters, or want it to survive you clearing your browser, make a free Netlify account first (top right) — same drag-and-drop, but the site becomes permanently yours and you can rename it (e.g. `the-fund.netlify.app`) or point a real domain at it later.

## Good to know

- **Truly no login**: this uses the same honor-system model you already had — anyone with the link can vote, add a date, post in trip talk, or edit the ledger. There's no per-person authentication. That's what makes zero-friction voting possible; it also means don't post the link anywhere public.
- **It's genuinely live now**: unlike the Claude version, votes actually save for everyone, from any device, with no editing-permissions issue — because this database has no such restriction.
- **Simultaneous edits**: if two people save at the exact same instant, the second write wins (last save sticks). For six friends casually voting this is a non-issue in practice.
- **The market ticker** currently shows a snapshot from Sep 3. It won't auto-refresh anymore on its own now that it's off Claude's infrastructure — happy to set up something for that if you want it kept current (or you can just leave it as a nice touch rather than live data).
- **Updating it later**: if you ever want a design or feature change, tell me and I'll hand you a new `index.html` — just drag it onto your Netlify site again (Site settings → Deploys → drag a new file in) to replace it; your data stays in Supabase untouched.
