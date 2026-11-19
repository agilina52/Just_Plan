"use client";

import type { PlanDocument, Wall } from "@just-plan/plan-schema";
import { Stage, Layer, Line, Circle, Text, Group, Image as KonvaImage } from "react-konva";
import { useEffect, useMemo, useRef, useState } from "react";
import type Konva from "konva";

type Props = {
  plan: PlanDocument;
  underlayUrl?: string | null;
  onPlanChange?: (plan: PlanDocument) => void;
};

function wallPoints(wall: Wall): number[] {
  return [wall.a[0], wall.a[1], wall.b[0], wall.b[1]];
}

export function PlanCanvas({ plan, underlayUrl, onPlanChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scale, setScale] = useState(0.08);
  const [offset, setOffset] = useState({ x: 40, y: 40 });
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!underlayUrl) {
      setImage(null);
      return;
    }
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setImage(img);
    img.src = underlayUrl.startsWith("http")
      ? underlayUrl
      : `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}${underlayUrl}`;
  }, [underlayUrl]);

  const bounds = useMemo(() => {
    let minX = 0;
    let minY = 0;
    let maxX = 8000;
    let maxY = 6000;
    for (const w of plan.walls) {
      minX = Math.min(minX, w.a[0], w.b[0]);
      minY = Math.min(minY, w.a[1], w.b[1]);
      maxX = Math.max(maxX, w.a[0], w.b[0]);
      maxY = Math.max(maxY, w.a[1], w.b[1]);
    }
    return { minX, minY, maxX, maxY };
  }, [plan.walls]);

  useEffect(() => {
    const worldW = Math.max(1, bounds.maxX - bounds.minX);
    const worldH = Math.max(1, bounds.maxY - bounds.minY);
    const fit = Math.min(
      (size.width - 80) / worldW,
      (size.height - 80) / worldH,
    );
    if (Number.isFinite(fit) && fit > 0) {
      setScale(fit);
      setOffset({
        x: (size.width - worldW * fit) / 2 - bounds.minX * fit,
        y: (size.height - worldH * fit) / 2 - bounds.minY * fit,
      });
    }
  }, [bounds, size.width, size.height, plan.meta.version]);

  function updateWall(id: string, patch: Partial<Wall>) {
    if (!onPlanChange) return;
    const walls = plan.walls.map((w) => (w.id === id ? { ...w, ...patch } : w));
    onPlanChange({ ...plan, walls });
  }

  function onWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;
    const oldScale = scale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const scaleBy = 1.05;
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const mousePointTo = {
      x: (pointer.x - offset.x) / oldScale,
      y: (pointer.y - offset.y) / oldScale,
    };
    setScale(newScale);
    setOffset({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  }

  return (
    <div ref={containerRef} className="h-full w-full bg-[#efe9dc]">
      <Stage
        width={size.width}
        height={size.height}
        scaleX={scale}
        scaleY={scale}
        x={offset.x}
        y={offset.y}
        draggable
        onWheel={onWheel}
        onDragEnd={(e) => {
          if (e.target === e.target.getStage()) {
            setOffset({ x: e.target.x(), y: e.target.y() });
          }
        }}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) setSelectedId(null);
        }}
      >
        <Layer>
          {image ? (
            <KonvaImage
              image={image}
              opacity={0.35}
              width={bounds.maxX - bounds.minX}
              height={bounds.maxY - bounds.minY}
              x={bounds.minX}
              y={bounds.minY}
            />
          ) : null}

          {plan.rooms.map((room) => (
            <Group key={room.id}>
              <Line
                points={room.polygon.flatMap((p) => p)}
                closed
                fill="rgba(47,93,80,0.06)"
                stroke="transparent"
              />
              {room.name ? (
                <Text
                  text={room.name}
                  x={room.polygon[0]?.[0] ?? 0}
                  y={room.polygon[0]?.[1] ?? 0}
                  fontSize={280}
                  fill="#2f5d50"
                  opacity={0.8}
                />
              ) : null}
            </Group>
          ))}

          {plan.walls.map((wall) => {
            const selected = selectedId === wall.id;
            return (
              <Group key={wall.id}>
                <Line
                  points={wallPoints(wall)}
                  stroke={selected ? "#c46b3a" : "#1a1f1c"}
                  strokeWidth={selected ? wall.thickness * 1.2 : wall.thickness}
                  lineCap="round"
                  hitStrokeWidth={Math.max(wall.thickness, 200)}
                  onClick={() => setSelectedId(wall.id)}
                  onTap={() => setSelectedId(wall.id)}
                />
                {selected ? (
                  <>
                    <Circle
                      x={wall.a[0]}
                      y={wall.a[1]}
                      radius={120}
                      fill="#c46b3a"
                      draggable
                      onDragMove={(e) => {
                        updateWall(wall.id, {
                          a: [e.target.x(), e.target.y()],
                        });
                      }}
                    />
                    <Circle
                      x={wall.b[0]}
                      y={wall.b[1]}
                      radius={120}
                      fill="#c46b3a"
                      draggable
                      onDragMove={(e) => {
                        updateWall(wall.id, {
                          b: [e.target.x(), e.target.y()],
                        });
                      }}
                    />
                  </>
                ) : null}
              </Group>
            );
          })}

          {plan.openings.map((opening) => {
            const wall = plan.walls.find((w) => w.id === opening.wallId);
            if (!wall) return null;
            const dx = wall.b[0] - wall.a[0];
            const dy = wall.b[1] - wall.a[1];
            const len = Math.hypot(dx, dy) || 1;
            const t = opening.offset / len;
            const x = wall.a[0] + dx * t;
            const y = wall.a[1] + dy * t;
            return (
              <Circle
                key={opening.id}
                x={x}
                y={y}
                radius={140}
                stroke="#2f5d50"
                strokeWidth={40}
                fill="rgba(243,239,230,0.9)"
              />
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
}
