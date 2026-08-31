#!/usr/bin/env python3
"""Files existing Metabase questions and dashboards into the collection tree.

setup-collections.sh creates the shelves; this puts things on them. A question's
home is derived from the table it actually queries, not from its name, because
names drift and the query does not. A dashboard follows its cards: whichever
collection most of them belong to.

Dry run by default — prints the moves and changes nothing. Pass --apply to make
them.

    ./organize-content.py                      # show the plan
    MB_URL=https://bi.example.com ./organize-content.py --apply

Auth matches the shell scripts: MB_URL and MB_SESSION from the environment, or
prompts. The password goes straight into the session call and is never stored.
"""
import getpass
import json
import os
import sys
import urllib.error
import urllib.request
from collections import Counter

# Which collection each source table belongs to. Staging tables sit with the
# mart they feed, so an ad-hoc question over stg_loans lands next to the lending
# marts rather than in a lookalike "staging" pile.
TABLE_COLLECTIONS = {
    "Program Reach": ["stg_clients", "mart_client_portfolio",
                      "mart_country_program_context"],
    "Lending": ["stg_loans", "stg_loan_repayments", "mart_loan_performance",
                "mart_repayment_performance"],
    "Business Growth": ["stg_businesses", "stg_business_metrics",
                        "mart_business_growth"],
    "Country Context": ["stg_observations", "stg_countries", "stg_indicators",
                        "stg_refugee_statistics", "mart_country_indicators",
                        "mart_country_refugee_stats", "mart_indicator_yoy_growth"],
}
TABLE_TO_COLLECTION = {t: c for c, ts in TABLE_COLLECTIONS.items() for t in ts}
ROOT_COLLECTION = "Self-Reliance Analytics"


class Metabase:
    def __init__(self, url, session):
        self.url, self.session = url.rstrip("/"), session

    def call(self, method, path, body=None):
        req = urllib.request.Request(
            f"{self.url}/api{path}", method=method,
            data=json.dumps(body).encode() if body is not None else None,
            headers={"Content-Type": "application/json",
                     "X-Metabase-Session": self.session})
        with urllib.request.urlopen(req) as r:
            raw = r.read()
        return json.loads(raw) if raw else None


def login(url):
    session = os.environ.get("MB_SESSION")
    if session:
        return session
    email = input("Email: ")
    password = getpass.getpass("Password: ")
    req = urllib.request.Request(
        f"{url.rstrip('/')}/api/session", method="POST",
        data=json.dumps({"username": email, "password": password}).encode(),
        headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        return json.load(r)["id"]


def collection_ids(mb):
    """Map collection name -> id, restricted to our tree so a same-named
    collection elsewhere in the instance is never targeted by accident."""
    everything = mb.call("GET", "/collection")
    root = next((c for c in everything
                 if c.get("name") == ROOT_COLLECTION and not c.get("archived")), None)
    if root is None:
        sys.exit(f"'{ROOT_COLLECTION}' not found. Run setup-collections.sh first.")
    ids = {ROOT_COLLECTION: root["id"]}
    for c in everything:
        if c.get("archived") or c.get("name") not in TABLE_COLLECTIONS:
            continue
        # Children carry a location path like "/12/"; fall back to parent_id.
        location = c.get("location") or ""
        if f"/{root['id']}/" in location or c.get("parent_id") == root["id"]:
            ids[c["name"]] = c["id"]
    missing = set(TABLE_COLLECTIONS) - set(ids)
    if missing:
        sys.exit(f"Missing collections: {', '.join(sorted(missing))}. "
                 "Re-run setup-collections.sh.")
    return ids


def card_table(card, table_names):
    """The table a card reads, for both query-builder and native questions."""
    query = card.get("dataset_query") or {}
    source = (query.get("query") or {}).get("source-table")
    if isinstance(source, int):
        return table_names.get(source)
    sql = ((query.get("native") or {}).get("query") or "").lower()
    # Longest name first: mart_country_indicators must win over stg_countries
    # when both appear in a join.
    for name in sorted(TABLE_TO_COLLECTION, key=len, reverse=True):
        if name in sql:
            return name
    return None


def plan_moves(mb, ids):
    table_names = {t["id"]: t["name"] for t in mb.call("GET", "/table")}
    cards = [c for c in mb.call("GET", "/card") if not c.get("archived")]

    moves, card_target, skipped = [], {}, []
    for card in cards:
        table = card_table(card, table_names)
        target = TABLE_TO_COLLECTION.get(table or "")
        if not target:
            skipped.append((card["name"], table or "unrecognised source"))
            continue
        card_target[card["id"]] = ids[target]
        if card.get("collection_id") != ids[target]:
            moves.append(("card", card["id"], card["name"], target, ids[target]))

    for dash in mb.call("GET", "/dashboard"):
        if dash.get("archived"):
            continue
        detail = mb.call("GET", f"/dashboard/{dash['id']}")
        votes = Counter(card_target[dc["card_id"]]
                        for dc in (detail.get("dashcards") or [])
                        if dc.get("card_id") in card_target)
        if not votes:
            skipped.append((dash["name"], "no recognisable cards"))
            continue
        # A dashboard spanning collections belongs at the top of the tree.
        winner, count = votes.most_common(1)[0]
        target_id = winner if count > sum(votes.values()) / 2 else ids[ROOT_COLLECTION]
        name = next(n for n, i in ids.items() if i == target_id)
        if dash.get("collection_id") != target_id:
            moves.append(("dashboard", dash["id"], dash["name"], name, target_id))
    return moves, skipped


def main():
    apply = "--apply" in sys.argv
    url = os.environ.get("MB_URL") or input("Metabase URL: ")
    mb = Metabase(url, login(url))
    moves, skipped = plan_moves(mb, collection_ids(mb))

    for kind, _id, name, target, _ in moves:
        print(f"  {kind:9} {name!r} -> {target}")
    for name, why in skipped:
        print(f"  skipped   {name!r} ({why})", file=sys.stderr)
    if not moves:
        print("Nothing to move — everything is already filed.")
        return

    if not apply:
        print(f"\n{len(moves)} move(s). Re-run with --apply to make them.")
        return
    for kind, item_id, name, target, target_id in moves:
        mb.call("PUT", f"/{kind}/{item_id}", {"collection_id": target_id})
        print(f"  moved {name!r} -> {target}")
    print(f"\nMoved {len(moves)} item(s).")


if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code} from Metabase: {e.read().decode()[:200]}")
