"""The cursor walk is what keeps the incremental pull from losing rows, so its
paging and stop conditions are pinned here."""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

import pytest

SRC = Path(__file__).resolve().parent.parent / "src"
sys.path.insert(0, str(SRC))

from clients_api_client import ClientsApiClient


def _page(rows, next_cursor):
    return {"data": rows, "meta": {"nextCursor": next_cursor}}


def test_follows_next_cursor_until_it_runs_out():
    responses = [
        _page([{"id": 1}, {"id": 2}], "cursor-a"),
        _page([{"id": 3}, {"id": 4}], "cursor-b"),
        _page([{"id": 5}], None),
    ]
    client = ClientsApiClient(page_size=2)

    with patch.object(ClientsApiClient, "_get_json", side_effect=responses) as get:
        pages = list(client.fetch_resource("loans"))

    assert [len(p) for p in pages] == [2, 2, 1]

    sent = [call.args[1] for call in get.call_args_list]
    assert "cursor" not in sent[0], "first request must not carry a cursor"
    assert sent[1]["cursor"] == "cursor-a"
    assert sent[2]["cursor"] == "cursor-b"
    assert all("page" not in params for params in sent), "must not use OFFSET paging"


def test_carries_the_watermark_on_every_request():
    responses = [
        _page([{"id": 1}], "cursor-a"),
        _page([{"id": 2}], None),
    ]
    client = ClientsApiClient(page_size=1)

    with patch.object(ClientsApiClient, "_get_json", side_effect=responses) as get:
        list(client.fetch_resource("clients", updated_since="2026-08-30T10:00:00Z"))

    for call in get.call_args_list:
        assert call.args[1]["updatedSince"] == "2026-08-30T10:00:00Z"


def test_stops_on_an_empty_first_page():
    client = ClientsApiClient()

    with patch.object(ClientsApiClient, "_get_json", side_effect=[_page([], None)]) as get:
        assert list(client.fetch_resource("businesses")) == []

    assert get.call_count == 1


def test_stops_when_a_page_comes_back_without_a_cursor():
    """A short page ends the walk even though it carried rows."""
    client = ClientsApiClient(page_size=500)

    with patch.object(
        ClientsApiClient, "_get_json", side_effect=[_page([{"id": 1}], None)]
    ) as get:
        pages = list(client.fetch_resource("advisory_sessions"))

    assert pages == [[{"id": 1}]]
    assert get.call_count == 1


def test_rejects_an_unknown_resource():
    with pytest.raises(ValueError, match="Unknown clients API resource"):
        list(ClientsApiClient().fetch_resource("not_a_resource"))
