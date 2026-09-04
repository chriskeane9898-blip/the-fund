-- The Fund — Supabase setup
-- Paste this whole file into Supabase: Project -> SQL Editor -> New query -> Run.

create table if not exists fund_state (
  id integer primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Anyone with the anon key (i.e. anyone who has the site's URL) can read
-- and update this one row. There is no login system, by design — that's
-- what makes voting/editing possible for everyone in the group without
-- accounts. It also means it's an honor-system page: don't put anything
-- in it you wouldn't want any visitor to be able to change.
alter table fund_state enable row level security;

create policy "anyone can read fund_state"
  on fund_state for select
  using (true);

create policy "anyone can update fund_state"
  on fund_state for update
  using (true)
  with check (true);

-- Turn on realtime for this table so every open browser tab gets
-- everyone else's votes/edits live, no refresh needed.
alter publication supabase_realtime add table fund_state;

-- Seed the single row with the site's starting data.
insert into fund_state (id, data) values (
  1,
  $json${
    "fund": {
      "total": 2100, "hysa": 1575, "investments": 525, "dues": 25,
      "ledger": [
        {"label": "Feb 2025", "entries": {"Keane":150,"Callipari":150,"Luke":150,"Justis":150,"Simon":150,"Bike":150}},
        {"label": "Sep 2025", "entries": {"Keane":25,"Callipari":25,"Luke":25,"Justis":25,"Simon":25,"Bike":25}},
        {"label": "Oct 2025", "entries": {"Keane":25,"Callipari":25,"Luke":25,"Justis":25,"Simon":25,"Bike":25}},
        {"label": "Nov 2025", "entries": {"Keane":25,"Callipari":25,"Luke":25,"Justis":25,"Simon":25,"Bike":25}}
      ]
    },
    "meeting": {"lastLabel": "", "lastNote": "", "decided": false, "nextLabel": ""},
    "dates": [],
    "trips": [],
    "discussion": [],
    "market": {
      "asOf": "Sep 3, 2026",
      "indexes": [
        {"name": "S&P 500", "value": "7,747.94", "change": "+1.06%", "dir": "up"},
        {"name": "NASDAQ", "value": "26,586.15", "change": "+1.40%", "dir": "up"},
        {"name": "DOW", "value": "53,694.52", "change": "+1.19%", "dir": "up"}
      ],
      "headlines": [
        "Fed's Waller signals no rate hike needed absent inflation surprise",
        "Xi visits Egypt as U.S. Mideast influence wanes amid Iran conflict",
        "Congress averts government shutdown ahead of midterms"
      ]
    }
  }$json$::jsonb
)
on conflict (id) do nothing;
