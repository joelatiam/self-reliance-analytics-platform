"""Value coercion shared by the source parsers."""
from __future__ import annotations

from typing import Any


def to_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    return float(value)


def to_int(value: Any) -> int | None:
    if value is None or value == "" or value == "-":
        return None
    return int(value)
