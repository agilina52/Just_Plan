from __future__ import annotations

import io
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

import cv2
import httpx
import numpy as np
from PIL import Image


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_image(image_url: str) -> np.ndarray:
    parsed = urlparse(image_url)
    if parsed.scheme in ("http", "https"):
        with httpx.Client(timeout=30.0) as client:
            resp = client.get(image_url)
            resp.raise_for_status()
            data = resp.content
        pil = Image.open(io.BytesIO(data)).convert("RGB")
    else:
        # Local path fallback
        path = image_url.replace("/files/raw/", "")
        pil = Image.open(path).convert("RGB")
    arr = np.array(pil)
    return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)


def _snap_ortho(x1: float, y1: float, x2: float, y2: float) -> tuple[float, float, float, float]:
    if abs(x2 - x1) >= abs(y2 - y1):
        y2 = y1
    else:
        x2 = x1
    return x1, y1, x2, y2


def _merge_colinear(segments: list[tuple[float, float, float, float]], tol: float = 12.0):
    if not segments:
        return []
    merged: list[tuple[float, float, float, float]] = []
    for seg in segments:
        x1, y1, x2, y2 = seg
        placed = False
        for i, (a1, b1, a2, b2) in enumerate(merged):
            horizontal = abs(y1 - y2) < tol and abs(b1 - b2) < tol and abs(y1 - b1) < tol
            vertical = abs(x1 - x2) < tol and abs(a1 - a2) < tol and abs(x1 - a1) < tol
            if horizontal:
                xs = sorted([x1, x2, a1, a2])
                merged[i] = (xs[0], b1, xs[-1], b1)
                placed = True
                break
            if vertical:
                ys = sorted([y1, y2, b1, b2])
                merged[i] = (a1, ys[0], a1, ys[-1])
                placed = True
                break
        if not placed:
            merged.append(seg)
    return merged


def vectorize_image_url(
    image_url: str,
    pixels_per_meter: float | None = None,
    source_image_id: str | None = None,
) -> dict[str, Any]:
    """Hybrid CV pipeline: Canny + Hough → orthogonal wall segments → PlanDocument."""
    try:
        img = _load_image(image_url)
    except Exception:
        # If image cannot be fetched, return a simple rectangular shell.
        return _fallback_plan(pixels_per_meter, source_image_id)

    h, w = img.shape[:2]
    scale = min(1.0, 1280 / max(h, w))
    if scale < 1.0:
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        h, w = img.shape[:2]

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    lines = cv2.HoughLinesP(
        edges,
        rho=1,
        theta=np.pi / 180,
        threshold=80,
        minLineLength=max(40, int(min(h, w) * 0.08)),
        maxLineGap=12,
    )

    segments: list[tuple[float, float, float, float]] = []
    if lines is not None:
        for line in lines[:, 0]:
            x1, y1, x2, y2 = map(float, line)
            x1, y1, x2, y2 = _snap_ortho(x1, y1, x2, y2)
            if abs(x2 - x1) + abs(y2 - y1) < 30:
                continue
            segments.append((x1, y1, x2, y2))

    segments = _merge_colinear(segments)

    # Convert pixel coords to mm-ish units using optional scale, else assume 50 px/m.
    ppm = pixels_per_meter or 50.0
    mm_per_px = 1000.0 / ppm

    walls = []
    for idx, (x1, y1, x2, y2) in enumerate(segments[:80]):
        walls.append(
            {
                "id": f"w{idx + 1}",
                "a": [round(x1 * mm_per_px), round(y1 * mm_per_px)],
                "b": [round(x2 * mm_per_px), round(y2 * mm_per_px)],
                "thickness": 200,
                "kind": "unknown",
            }
        )

    if not walls:
        return _fallback_plan(pixels_per_meter, source_image_id)

    return {
        "units": "mm",
        "scale": {"pixelsPerMeter": pixels_per_meter},
        "walls": walls,
        "openings": [],
        "rooms": [],
        "furniture": [],
        "meta": {
            "sourceImageId": source_image_id,
            "version": 1,
            "createdAt": _now(),
            "updatedAt": _now(),
        },
    }


def _fallback_plan(
    pixels_per_meter: float | None,
    source_image_id: str | None,
) -> dict[str, Any]:
    return {
        "units": "mm",
        "scale": {"pixelsPerMeter": pixels_per_meter},
        "walls": [
            {"id": "w1", "a": [0, 0], "b": [8000, 0], "thickness": 200, "kind": "exterior"},
            {"id": "w2", "a": [8000, 0], "b": [8000, 6000], "thickness": 200, "kind": "exterior"},
            {"id": "w3", "a": [8000, 6000], "b": [0, 6000], "thickness": 200, "kind": "exterior"},
            {"id": "w4", "a": [0, 6000], "b": [0, 0], "thickness": 200, "kind": "exterior"},
        ],
        "openings": [],
        "rooms": [
            {
                "id": "r1",
                "name": "помещение",
                "polygon": [[0, 0], [8000, 0], [8000, 6000], [0, 6000]],
                "tags": [],
            }
        ],
        "furniture": [],
        "meta": {
            "sourceImageId": source_image_id,
            "version": 1,
            "createdAt": _now(),
            "updatedAt": _now(),
        },
    }
