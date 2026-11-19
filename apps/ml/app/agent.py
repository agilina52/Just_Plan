from __future__ import annotations

import json
import os
import re
from copy import deepcopy
from typing import Any

TOOLS_SPEC = [
    {
        "type": "function",
        "function": {
            "name": "add_wall",
            "description": "Add a wall segment to the plan",
            "parameters": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "a": {"type": "array", "items": {"type": "number"}, "minItems": 2, "maxItems": 2},
                    "b": {"type": "array", "items": {"type": "number"}, "minItems": 2, "maxItems": 2},
                    "thickness": {"type": "number"},
                    "kind": {"type": "string", "enum": ["exterior", "interior", "unknown"]},
                },
                "required": ["a", "b"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "move_wall",
            "description": "Move wall endpoints",
            "parameters": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "a": {"type": "array", "items": {"type": "number"}},
                    "b": {"type": "array", "items": {"type": "number"}},
                },
                "required": ["id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_opening",
            "description": "Add door/window on a wall",
            "parameters": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "wallId": {"type": "string"},
                    "offset": {"type": "number"},
                    "width": {"type": "number"},
                    "type": {"type": "string", "enum": ["door", "window", "opening"]},
                },
                "required": ["wallId"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_room_label",
            "description": "Rename a room",
            "parameters": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "name": {"type": "string"},
                },
                "required": ["id", "name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "remove_entity",
            "description": "Remove wall/opening/room/furniture by id",
            "parameters": {
                "type": "object",
                "properties": {"id": {"type": "string"}},
                "required": ["id"],
            },
        },
    },
]


SYSTEM_PROMPT = """You are Just Plan layout agent.
You mutate floor plans represented as structured JSON (walls, openings, rooms).
Never return raster images. Prefer tool calls for edits.
Units are millimeters. Keep exterior outline unless asked otherwise.
Consider ergonomics: door clearances ~900mm, corridors >=900mm when suggesting changes.
"""


def run_agent(message: str, plan: dict[str, Any]) -> dict[str, Any]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return _heuristic_agent(message, plan)

    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key)
        model = os.getenv("LLM_MODEL", "gpt-4o")
        completion = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"Current plan JSON:\n{json.dumps(plan, ensure_ascii=False)}\n\n"
                        f"User request: {message}"
                    ),
                },
            ],
            tools=TOOLS_SPEC,
            tool_choice="auto",
            temperature=0.2,
        )
        choice = completion.choices[0].message
        tool_calls: list[dict[str, Any]] = []
        if choice.tool_calls:
            for tc in choice.tool_calls:
                tool_calls.append(
                    {
                        "name": tc.function.name,
                        "arguments": json.loads(tc.function.arguments or "{}"),
                    }
                )
        reply = choice.content or "Готово: применил изменения к плану."
        return {"reply": reply, "tool_calls": tool_calls}
    except Exception as exc:  # noqa: BLE001
        result = _heuristic_agent(message, plan)
        result["reply"] = f"{result['reply']} (LLM fallback: {exc})"
        return result


def _ensure_shell(plan: dict[str, Any]) -> dict[str, Any]:
    if plan.get("walls"):
        return plan
    plan = deepcopy(plan)
    plan["walls"] = [
        {"id": "w1", "a": [0, 0], "b": [8000, 0], "thickness": 200, "kind": "exterior"},
        {"id": "w2", "a": [8000, 0], "b": [8000, 6000], "thickness": 200, "kind": "exterior"},
        {"id": "w3", "a": [8000, 6000], "b": [0, 6000], "thickness": 200, "kind": "exterior"},
        {"id": "w4", "a": [0, 6000], "b": [0, 0], "thickness": 200, "kind": "exterior"},
        {"id": "w5", "a": [4000, 0], "b": [4000, 6000], "thickness": 120, "kind": "interior"},
    ]
    plan["rooms"] = [
        {
            "id": "r1",
            "name": "комната 1",
            "polygon": [[0, 0], [4000, 0], [4000, 6000], [0, 6000]],
            "tags": [],
        },
        {
            "id": "r2",
            "name": "комната 2",
            "polygon": [[4000, 0], [8000, 0], [8000, 6000], [4000, 6000]],
            "tags": [],
        },
    ]
    plan.setdefault("openings", [])
    plan.setdefault("furniture", [])
    return plan


def _heuristic_agent(message: str, plan: dict[str, Any]) -> dict[str, Any]:
    lower = message.lower()
    needs_shell = any(
        key in lower
        for key in (
            "двер",
            "door",
            "стен",
            "wall",
            "кухн",
            "kitchen",
            "open-space",
            "open space",
            "убери",
        )
    )
    current = _ensure_shell(plan) if needs_shell else deepcopy(plan)
    tools: list[dict[str, Any]] = []

    if "open-space" in lower or "open space" in lower or "убери стен" in lower:
        interior = next((w for w in current.get("walls", []) if w.get("kind") == "interior"), None)
        if interior:
            tools.append({"name": "remove_entity", "arguments": {"id": interior["id"]}})
            current["walls"] = [w for w in current["walls"] if w["id"] != interior["id"]]
            current["openings"] = [
                o for o in current.get("openings", []) if o.get("wallId") != interior["id"]
            ]
            return {
                "reply": f"Удалил внутреннюю стену {interior['id']} для open-space.",
                "tool_calls": tools,
                "plan": current,
            }

    if ("кухн" in lower or "kitchen" in lower) and current.get("rooms"):
        room = current["rooms"][0]
        tools.append(
            {"name": "set_room_label", "arguments": {"id": room["id"], "name": "кухня"}}
        )
        current["rooms"][0] = {**room, "name": "кухня", "tags": ["kitchen"]}
        return {
            "reply": f"Комната {room['id']} теперь «кухня».",
            "tool_calls": tools,
            "plan": current,
        }

    if "двер" in lower or "door" in lower:
        wall = next(
            (w for w in current.get("walls", []) if w.get("kind") == "interior"),
            (current.get("walls") or [None])[0],
        )
        if wall:
            opening = {
                "id": "d_auto",
                "wallId": wall["id"],
                "offset": 1000,
                "width": 900,
                "type": "door",
            }
            tools.append({"name": "add_opening", "arguments": opening})
            current.setdefault("openings", []).append(opening)
            return {
                "reply": f"Добавил дверь на стену {wall['id']}.",
                "tool_calls": tools,
                "plan": current,
            }

    if "стен" in lower or "wall" in lower:
        wall = {
            "id": "w_auto",
            "a": [2000, 0],
            "b": [2000, 6000],
            "thickness": 120,
            "kind": "interior",
        }
        tools.append({"name": "add_wall", "arguments": wall})
        current.setdefault("walls", []).append(wall)
        return {
            "reply": f"Добавил внутреннюю стену {wall['id']}.",
            "tool_calls": tools,
            "plan": current,
        }

    return {
        "reply": (
            "Нет OPENAI_API_KEY — работаю эвристиками. "
            "Попробуйте: open-space, кухня, дверь."
        ),
        "tool_calls": [{"name": "get_plan", "arguments": {}}],
        "plan": current,
    }
