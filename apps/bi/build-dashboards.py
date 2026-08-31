#!/usr/bin/env python3
"""Builds the saved questions and dashboards described in dashboards/*.json.

Metabase OSS cannot import dashboards — serialization is an enterprise feature —
so this is the closest thing to dashboards-as-code the instance allows: the
questions live in version control as SQL, and this replays them through the API.

Every query is plain SQL against the dbt marts, unqualified so it resolves to
whatever database the Metabase connection points at.

Idempotent by name within a collection: a card or dashboard that already exists
is updated in place rather than duplicated, so re-running after editing a spec
edits the real thing.

    ./build-dashboards.py                     # show what would be built
    MB_URL=https://bi.example.com ./build-dashboards.py --apply
"""
import json
import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from metabase_api import (Metabase, collection_ids, connect,  # noqa: E402
                          clickhouse_database, die_on_http_error)

SPEC_DIR = pathlib.Path(__file__).resolve().parent / "dashboards"


def load_specs():
    specs = [json.loads(p.read_text()) for p in sorted(SPEC_DIR.glob("*.json"))]
    if not specs:
        sys.exit(f"No dashboard specs found in {SPEC_DIR}")
    return specs


def upsert_card(mb, spec_card, collection_id, database_id, existing, apply):
    payload = {
        "name": spec_card["name"],
        "description": spec_card.get("description"),
        "display": spec_card["display"],
        "visualization_settings": spec_card.get("visualization_settings", {}),
        "collection_id": collection_id,
        "dataset_query": {
            "database": database_id,
            "type": "native",
            "native": {"query": spec_card["sql"], "template-tags": {}},
        },
    }
    current = existing.get(spec_card["name"])
    if current:
        print(f"    ~ {spec_card['name']} (update)")
        if apply:
            mb.call("PUT", f"/card/{current}", payload)
        return current
    print(f"    + {spec_card['name']}")
    if not apply:
        return None
    return mb.call("POST", "/card", payload)["id"]


def upsert_dashboard(mb, spec, collection_id, card_ids, apply):
    name = spec["dashboard"]["name"]
    existing = {d["name"]: d["id"] for d in mb.collection_items(collection_id, "dashboard")}
    dashboard_id = existing.get(name)
    payload = {"name": name, "description": spec["dashboard"].get("description"),
               "collection_id": collection_id}
    if dashboard_id:
        print(f"    ~ dashboard {name!r} (update)")
        if apply:
            mb.call("PUT", f"/dashboard/{dashboard_id}", payload)
    else:
        print(f"    + dashboard {name!r}")
        if not apply:
            return
        dashboard_id = mb.call("POST", "/dashboard", payload)["id"]

    if not apply:
        return
    # Dashcards are replaced wholesale: the spec is the source of truth for
    # layout, so a card removed from it disappears from the dashboard too.
    # Negative ids mark cards that do not exist on the dashboard yet.
    dashcards = [{
        "id": -(index + 1),
        "card_id": card_id,
        "row": card["row"], "col": card["col"],
        "size_x": card["size_x"], "size_y": card["size_y"],
        "series": [], "parameter_mappings": [], "visualization_settings": {},
    } for index, (card, card_id) in enumerate(zip(spec["cards"], card_ids)) if card_id]
    mb.call("PUT", f"/dashboard/{dashboard_id}", {"dashcards": dashcards})


def build(mb, apply):
    specs = load_specs()
    ids = collection_ids(mb, {s["collection"] for s in specs})
    database_id = int(os.environ.get("MB_DATABASE_ID") or clickhouse_database(mb))
    print(f"ClickHouse database id: {database_id}\n")

    for spec in specs:
        collection_id = ids[spec["collection"]]
        print(f"  {spec['collection']}")
        existing = {c["name"]: c["id"] for c in mb.collection_items(collection_id, "card")}
        card_ids = [upsert_card(mb, card, collection_id, database_id, existing, apply)
                    for card in spec["cards"]]
        upsert_dashboard(mb, spec, collection_id, card_ids, apply)
        print()

    total = sum(len(s["cards"]) for s in specs)
    if apply:
        print(f"Built {len(specs)} dashboard(s) and {total} question(s).")
    else:
        print(f"Would build {len(specs)} dashboard(s) and {total} question(s). "
              "Re-run with --apply.")


def main():
    apply = "--apply" in sys.argv
    mb = connect()
    build(mb, apply)


if __name__ == "__main__":
    die_on_http_error(main)
