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
import json
import os
import pathlib
import sys
from collections import Counter

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from metabase_api import (ROOT_COLLECTION, collection_ids, connect,  # noqa: E402
                          die_on_http_error)

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
    mb = connect()
    moves, skipped = plan_moves(mb, collection_ids(mb, TABLE_COLLECTIONS))

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
    die_on_http_error(main)
