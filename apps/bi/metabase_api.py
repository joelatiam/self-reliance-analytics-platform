"""Shared Metabase API access for the scripts in this directory.

Stdlib only, so these run on the droplet with nothing installed.
"""
import getpass
import json
import os
import sys
import urllib.error
import urllib.request

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

    def collection_items(self, collection_id, model):
        result = self.call("GET", f"/collection/{collection_id}/items?models={model}")
        return (result or {}).get("data", [])


def connect():
    """Resolve URL and session from the environment, prompting for what is
    missing. The password goes straight into the session call and is never
    stored, exported or echoed."""
    url = os.environ.get("MB_URL") or input("Metabase URL: ")
    session = os.environ.get("MB_SESSION")
    if not session:
        email = input("Email: ")
        password = getpass.getpass("Password: ")
        req = urllib.request.Request(
            f"{url.rstrip('/')}/api/session", method="POST",
            data=json.dumps({"username": email, "password": password}).encode(),
            headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req) as r:
            session = json.load(r)["id"]
    return Metabase(url, session)


def collection_ids(mb, wanted):
    """Map collection name -> id for our tree only, so a same-named collection
    elsewhere in the instance is never targeted by accident."""
    everything = mb.call("GET", "/collection")
    root = next((c for c in everything
                 if c.get("name") == ROOT_COLLECTION and not c.get("archived")), None)
    if root is None:
        sys.exit(f"'{ROOT_COLLECTION}' not found. Run setup-collections.sh first.")
    ids = {ROOT_COLLECTION: root["id"]}
    for c in everything:
        if c.get("archived") or c.get("name") not in wanted:
            continue
        # Children carry a location path like "/12/"; parent_id is not returned
        # by every version, so location is checked first.
        location = c.get("location") or ""
        if f"/{root['id']}/" in location or c.get("parent_id") == root["id"]:
            ids[c["name"]] = c["id"]
    missing = set(wanted) - set(ids)
    if missing:
        sys.exit(f"Missing collections: {', '.join(sorted(missing))}. "
                 "Re-run setup-collections.sh.")
    return ids


def clickhouse_database(mb):
    """The ClickHouse connection's id. Errors rather than guessing when the
    instance has several, since writing questions against the wrong one is
    silent and annoying to undo."""
    result = mb.call("GET", "/database")
    databases = result.get("data") if isinstance(result, dict) else result
    matches = [d for d in databases if d.get("engine") == "clickhouse"]
    if not matches:
        sys.exit("No ClickHouse database is connected in Metabase.")
    if len(matches) > 1:
        names = ", ".join(f"{d['name']} (id {d['id']})" for d in matches)
        sys.exit(f"Several ClickHouse databases: {names}. Set MB_DATABASE_ID.")
    return matches[0]["id"]


def die_on_http_error(fn):
    try:
        fn()
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code} from Metabase: {e.read().decode()[:300]}")
