#!/usr/bin/env python3
"""Refresh The Fund's market/news ticker.

Runs on GitHub Actions (normal internet access, unlike the sandboxed
environment this was first tried from) on a daily cron. Fetches live
index levels + headlines and PATCHes ONLY the "market" key of the single
fund_state row in Supabase -- every other field (fund, meeting, dates,
trips, discussion) is read back and re-sent untouched, so this can never
clobber real votes/ledger/discussion data.

Requires two env vars: SUPABASE_URL, SUPABASE_ANON_KEY.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET

UA = {"User-Agent": "Mozilla/5.0 (compatible; TheFundTickerBot/1.0)"}

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_ANON_KEY = os.environ["SUPABASE_ANON_KEY"]

INDEXES = [
    ("S&P 500", "%5EGSPC"),
    ("NASDAQ", "%5EIXIC"),
    ("DOW", "%5EDJI"),
]


def fetch_json(url, headers=None, data=None, method=None, timeout=20):
    req = urllib.request.Request(url, headers=headers or {}, data=data, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        body = r.read()
        return r.status, (json.loads(body) if body else None)


def fetch_index(symbol_encoded):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol_encoded}?range=5d&interval=1d"
    _, data = fetch_json(url, headers=UA)
    meta = data["chart"]["result"][0]["meta"]
    price = float(meta["regularMarketPrice"])
    prev_close = float(meta.get("chartPreviousClose") or meta.get("previousClose"))
    pct = (price - prev_close) / prev_close * 100.0
    return price, pct


def fmt_value(v):
    return f"{v:,.2f}"


def fmt_change(pct):
    sign = "+" if pct >= 0 else ""
    return f"{sign}{pct:.2f}%"


def get_indexes():
    out = []
    for name, sym in INDEXES:
        try:
            price, pct = fetch_index(sym)
        except Exception as e:
            print(f"WARN: could not fetch {name}: {e}", file=sys.stderr)
            continue
        out.append({
            "name": name,
            "value": fmt_value(price),
            "change": fmt_change(pct),
            "dir": "up" if pct >= 0 else "down",
        })
    return out


def get_headlines(limit=3):
    headlines = []
    try:
        req = urllib.request.Request("https://feeds.npr.org/1001/rss.xml", headers=UA)
        with urllib.request.urlopen(req, timeout=20) as r:
            xml_data = r.read()
        root = ET.fromstring(xml_data)
        for item in root.iter("item"):
            title_el = item.find("title")
            if title_el is not None and title_el.text:
                t = " ".join(title_el.text.split())
                if t and len(t) <= 100:
                    headlines.append(t)
            if len(headlines) >= limit:
                break
    except Exception as e:
        print(f"WARN: could not fetch headlines: {e}", file=sys.stderr)
    return headlines


def main():
    indexes = get_indexes()
    headlines = get_headlines()

    if not indexes and not headlines:
        print("ERROR: got neither index data nor headlines — aborting without writing.", file=sys.stderr)
        sys.exit(1)

    as_of = time.strftime("%b %d, %Y").replace(" 0", " ")  # "Sep 08" -> "Sep 8"

    # 1) Read the current row so we only ever touch the "market" key.
    try:
        _, rows = fetch_json(
            f"{SUPABASE_URL}/rest/v1/fund_state?select=data&id=eq.1",
            headers={"apikey": SUPABASE_ANON_KEY},
        )
    except urllib.error.HTTPError as e:
        print(f"ERROR: GET from Supabase failed: {e.code} {e.read()}", file=sys.stderr)
        sys.exit(1)

    if not rows:
        print("ERROR: no rows returned from fund_state — aborting without writing.", file=sys.stderr)
        sys.exit(1)

    data = rows[0]["data"]
    data["market"] = {
        "asOf": as_of,
        "indexes": indexes if indexes else data.get("market", {}).get("indexes", []),
        "headlines": headlines if headlines else data.get("market", {}).get("headlines", []),
    }

    payload = json.dumps({
        "data": data,
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }).encode()

    # 2) Write back the WHOLE object (fund/meeting/dates/trips/discussion
    # unchanged, market refreshed).
    try:
        status, _ = fetch_json(
            f"{SUPABASE_URL}/rest/v1/fund_state?id=eq.1",
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            data=payload,
            method="PATCH",
        )
    except urllib.error.HTTPError as e:
        print(f"ERROR: PATCH to Supabase failed: {e.code} {e.read()}", file=sys.stderr)
        sys.exit(1)

    print(f"OK: updated market data as of {as_of} — {len(indexes)} indexes, {len(headlines)} headlines.")


if __name__ == "__main__":
    main()
