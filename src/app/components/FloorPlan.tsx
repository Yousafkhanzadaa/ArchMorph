"use client";

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import {
  type Opening,
  type Project,
  type Room,
  type RoomType,
  type Wall,
  round,
  roomArea,
  wallLength,
} from "@/lib/architecture";

export type CanvasTool = "select" | "room" | "wall" | "door" | "window" | "measure";

type Point = { x: number; y: number };
type DragState =
  | { kind: "move-room"; id: string; start: Point; origin: Point; room: Room }
  | { kind: "resize-room"; id: string; start: Point; room: Room }
  | { kind: "move-wall"; id: string; start: Point; origin: Wall; wall: Wall }
  | { kind: "draw-wall"; start: Point; current: Point }
  | { kind: "measure"; start: Point; current: Point };

type FloorPlanProps = {
  project: Project;
  tool: CanvasTool;
  roomType: RoomType;
  selectedId?: string;
  svgRef: RefObject<SVGSVGElement | null>;
  onSelect: (id?: string) => void;
  onCreateRoom: (point: Point, type: RoomType) => void;
  onMoveRoom: (id: string, point: Point) => void;
  onResizeRoom: (id: string, width: number, length: number) => void;
  onAddWall: (start: Point, end: Point) => void;
  onMoveWall: (id: string, dx: number, dy: number) => void;
  onAddOpening: (kind: "door" | "window", wallId: string, offset: number) => void;
};

const snap = (value: number, grid = 0.5) => round(Math.round(value / grid) * grid);

function roomLabel(room: Room) {
  return room.name.length > 18 ? `${room.name.slice(0, 17)}…` : room.name;
}

function openingGeometry(opening: Opening, walls: Wall[]) {
  const wall = walls.find((item) => item.id === opening.wallId);
  if (!wall) return null;
  const length = wallLength(wall);
  const ratio = length ? opening.offset / length : 0;
  const x = wall.x1 + (wall.x2 - wall.x1) * ratio;
  const y = wall.y1 + (wall.y2 - wall.y1) * ratio;
  const angle = Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1) * (180 / Math.PI);
  return { wall, x, y, angle };
}

export default function FloorPlan({
  project,
  tool,
  roomType,
  selectedId,
  svgRef,
  onSelect,
  onCreateRoom,
  onMoveRoom,
  onResizeRoom,
  onAddWall,
  onMoveWall,
  onAddOpening,
}: FloorPlanProps) {
  const [drag, setDrag] = useState<DragState>();
  const [measurement, setMeasurement] = useState<{ start: Point; end: Point }>();
  const localSvgRef = useRef<SVGSVGElement | null>(null);
  const floorId = project.view.activeFloorId;
  const rooms = project.rooms.filter((room) => room.floorId === floorId);
  const walls = project.walls.filter((wall) => wall.floorId === floorId);
  const openings = project.openings.filter((opening) => opening.floorId === floorId);
  const stairs = project.stairs.filter((stair) => stair.floorId === floorId);
  const viewBox = useMemo(
    () => `${-8} ${-7} ${project.plot.width + 16} ${project.plot.length + 19}`,
    [project.plot.length, project.plot.width],
  );

  const setRefs = (node: SVGSVGElement | null) => {
    localSvgRef.current = node;
    if (svgRef && "current" in svgRef) svgRef.current = node;
  };

  const toPoint = (event: ReactPointerEvent<SVGElement>): Point => {
    const svg = localSvgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = svg.getScreenCTM()?.inverse();
    const transformed = matrix ? point.matrixTransform(matrix) : point;
    return { x: snap(transformed.x), y: snap(transformed.y) };
  };

  const roomForRender = (room: Room) => {
    if (drag?.kind === "move-room" && drag.id === room.id) return drag.room;
    if (drag?.kind === "resize-room" && drag.id === room.id) return drag.room;
    return room;
  };

  const handleBackgroundPointerDown = (event: ReactPointerEvent<SVGRectElement>) => {
    const point = toPoint(event);
    onSelect(undefined);
    if (tool === "room") onCreateRoom(point, roomType);
    if (tool === "wall") {
      event.currentTarget.setPointerCapture(event.pointerId);
      setDrag({ kind: "draw-wall", start: point, current: point });
    }
    if (tool === "measure") {
      event.currentTarget.setPointerCapture(event.pointerId);
      setDrag({ kind: "measure", start: point, current: point });
      setMeasurement(undefined);
    }
  };

  const handleRoomPointerDown = (event: ReactPointerEvent<SVGRectElement>, room: Room) => {
    if (tool !== "select") return;
    event.stopPropagation();
    onSelect(room.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = toPoint(event);
    setDrag({ kind: "move-room", id: room.id, start: point, origin: { x: room.x, y: room.y }, room });
  };

  const handleResizePointerDown = (event: ReactPointerEvent<SVGCircleElement>, room: Room) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ kind: "resize-room", id: room.id, start: toPoint(event), room });
  };

  const handleWallPointerDown = (event: ReactPointerEvent<SVGLineElement>, wall: Wall) => {
    event.stopPropagation();
    const point = toPoint(event);
    if (tool === "door" || tool === "window") {
      const length = wallLength(wall);
      const dx = wall.x2 - wall.x1;
      const dy = wall.y2 - wall.y1;
      const offset = length ? ((point.x - wall.x1) * dx + (point.y - wall.y1) * dy) / length : 0;
      onAddOpening(tool, wall.id, Math.max(tool === "door" ? 1.5 : 2, snap(offset)));
      return;
    }
    if (tool === "select") {
      onSelect(wall.id);
      if (!wall.roomId) {
        event.currentTarget.setPointerCapture(event.pointerId);
        setDrag({ kind: "move-wall", id: wall.id, start: point, origin: wall, wall });
      }
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const point = toPoint(event);
    if (drag.kind === "move-room") {
      const dx = point.x - drag.start.x;
      const dy = point.y - drag.start.y;
      const x = Math.max(0, Math.min(project.plot.width - drag.room.width, snap(drag.origin.x + dx)));
      const y = Math.max(0, Math.min(project.plot.length - drag.room.length, snap(drag.origin.y + dy)));
      setDrag({ ...drag, room: { ...drag.room, x, y } });
    } else if (drag.kind === "resize-room") {
      const width = Math.max(3, Math.min(project.plot.width - drag.room.x, snap(point.x - drag.room.x)));
      const length = Math.max(3, Math.min(project.plot.length - drag.room.y, snap(point.y - drag.room.y)));
      setDrag({ ...drag, room: { ...drag.room, width, length } });
    } else if (drag.kind === "draw-wall" || drag.kind === "measure") {
      setDrag({ ...drag, current: point });
    } else if (drag.kind === "move-wall") {
      const dx = point.x - drag.start.x;
      const dy = point.y - drag.start.y;
      setDrag({ ...drag, wall: {
        ...drag.origin,
        x1: snap(drag.origin.x1 + dx), y1: snap(drag.origin.y1 + dy),
        x2: snap(drag.origin.x2 + dx), y2: snap(drag.origin.y2 + dy),
      } });
    }
  };

  const finishPointerAction = () => {
    if (!drag) return;
    if (drag.kind === "move-room") onMoveRoom(drag.id, { x: drag.room.x, y: drag.room.y });
    if (drag.kind === "resize-room") onResizeRoom(drag.id, drag.room.width, drag.room.length);
    if (drag.kind === "draw-wall" && Math.hypot(drag.current.x - drag.start.x, drag.current.y - drag.start.y) >= 1) {
      onAddWall(drag.start, drag.current);
    }
    if (drag.kind === "move-wall") {
      onMoveWall(drag.id, drag.wall.x1 - drag.origin.x1, drag.wall.y1 - drag.origin.y1);
    }
    if (drag.kind === "measure") setMeasurement({ start: drag.start, end: drag.current });
    setDrag(undefined);
  };

  const activeMeasurement = drag?.kind === "measure" ? { start: drag.start, end: drag.current } : measurement;
  const previewWall = drag?.kind === "draw-wall" ? drag : undefined;
  const selectedRoom = rooms.find((room) => room.id === selectedId);

  return (
    <svg
      ref={setRefs}
      viewBox={viewBox}
      className={`floor-plan floor-plan--${tool}`}
      role="img"
      aria-label={`Architectural floor plan for ${project.name}`}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointerAction}
      onPointerCancel={() => setDrag(undefined)}
    >
      <defs>
        <pattern id="minor-grid" width="1" height="1" patternUnits="userSpaceOnUse">
          <path d="M 1 0 L 0 0 0 1" fill="none" stroke="#b7bbb8" strokeOpacity="0.18" strokeWidth="0.04" />
        </pattern>
        <pattern id="major-grid" width="5" height="5" patternUnits="userSpaceOnUse">
          <rect width="5" height="5" fill="url(#minor-grid)" />
          <path d="M 5 0 L 0 0 0 5" fill="none" stroke="#808781" strokeOpacity="0.25" strokeWidth="0.07" />
        </pattern>
        <filter id="room-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0.3" stdDeviation="0.35" floodColor="#1e2722" floodOpacity="0.16" />
        </filter>
        <filter id="focus-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="0.55" floodColor="#d35f35" floodOpacity="0.9" />
        </filter>
      </defs>

      <rect x="-8" y="-7" width={project.plot.width + 16} height={project.plot.length + 19} fill="#f4f2ed" />
      <rect
        x="0" y="0" width={project.plot.width} height={project.plot.length}
        fill="url(#major-grid)" stroke="#28322c" strokeWidth="0.22" vectorEffect="non-scaling-stroke"
        onPointerDown={handleBackgroundPointerDown}
      />

      <g className="street-marking" pointerEvents="none">
        <line x1="0" y1="-2.7" x2={project.plot.width} y2="-2.7" stroke="#929792" strokeWidth="0.12" strokeDasharray="1 0.8" />
        <text x={project.plot.width / 2} y="-3.7" textAnchor="middle" className="plot-note">FRONT / ACCESS STREET</text>
      </g>

      <g className="setbacks" pointerEvents="none">
        <rect
          x={project.plot.setbacks.left}
          y={project.plot.setbacks.front}
          width={Math.max(0, project.plot.width - project.plot.setbacks.left - project.plot.setbacks.right)}
          height={Math.max(0, project.plot.length - project.plot.setbacks.front - project.plot.setbacks.rear)}
          fill="#708a7710" stroke="#7b8d80" strokeWidth="0.12" strokeDasharray="0.6 0.45"
        />
        <text x={project.plot.setbacks.left + 0.6} y={project.plot.setbacks.front + 1.1} className="setback-label">BUILDABLE ENVELOPE</text>
      </g>

      <g className="plot-dimensions" pointerEvents="none">
        <line x1="0" y1={project.plot.length + 2.5} x2={project.plot.width} y2={project.plot.length + 2.5} />
        <line x1="0" y1={project.plot.length + 1.7} x2="0" y2={project.plot.length + 3.2} />
        <line x1={project.plot.width} y1={project.plot.length + 1.7} x2={project.plot.width} y2={project.plot.length + 3.2} />
        <text x={project.plot.width / 2} y={project.plot.length + 4.1} textAnchor="middle">{project.plot.width}&apos;–0&quot;</text>
        <line x1={project.plot.width + 2.5} y1="0" x2={project.plot.width + 2.5} y2={project.plot.length} />
        <line x1={project.plot.width + 1.7} y1="0" x2={project.plot.width + 3.2} y2="0" />
        <line x1={project.plot.width + 1.7} y1={project.plot.length} x2={project.plot.width + 3.2} y2={project.plot.length} />
        <text x={project.plot.width + 4} y={project.plot.length / 2} textAnchor="middle" transform={`rotate(90 ${project.plot.width + 4} ${project.plot.length / 2})`}>{project.plot.length}&apos;–0&quot;</text>
      </g>

      <g className="north-arrow" transform={`translate(${project.plot.width + 5.3} 5)`} pointerEvents="none">
        <text x="0" y="-2.1" textAnchor="middle">N</text>
        <path d="M0,-1.5 L-0.75,1.5 L0,0.95 L0.75,1.5 Z" fill="#25322b" />
      </g>

      {rooms.map((rawRoom) => {
        const room = roomForRender(rawRoom);
        const selected = room.id === selectedId;
        const focused = room.id === project.view.focusElementId;
        return (
          <g key={room.id} className={`room-group ${selected ? "is-selected" : ""}`}>
            <rect
              x={room.x} y={room.y} width={room.width} height={room.length}
              fill={room.color} fillOpacity={room.type === "Courtyard" ? 0.34 : 0.72}
              stroke={selected ? "#d65b32" : "#35423a"} strokeWidth={selected ? 0.28 : 0.08}
              strokeDasharray={room.type === "Courtyard" ? "0.7 0.4" : undefined}
              filter={focused ? "url(#focus-glow)" : "url(#room-shadow)"}
              vectorEffect="non-scaling-stroke"
              onPointerDown={(event) => handleRoomPointerDown(event, room)}
            />
            <g pointerEvents="none" className="room-label">
              <text x={room.x + room.width / 2} y={room.y + room.length / 2 - 0.35} textAnchor="middle" className="room-name">{roomLabel(room)}</text>
              <text x={room.x + room.width / 2} y={room.y + room.length / 2 + 1.05} textAnchor="middle" className="room-area">{roomArea(room)} sq ft</text>
              <text x={room.x + room.width / 2} y={room.y + room.length - 0.65} textAnchor="middle" className="room-size">{room.width}&apos; × {room.length}&apos;</text>
            </g>
            {selected && (
              <>
                <line x1={room.x} y1={room.y - 0.65} x2={room.x + room.width} y2={room.y - 0.65} className="selection-dimension" pointerEvents="none" />
                <text x={room.x + room.width / 2} y={room.y - 1} textAnchor="middle" className="selection-dimension-text" pointerEvents="none">{room.width}&apos;–0&quot;</text>
                <circle
                  cx={room.x + room.width} cy={room.y + room.length} r="0.52"
                  className="resize-handle"
                  onPointerDown={(event) => handleResizePointerDown(event, room)}
                />
              </>
            )}
          </g>
        );
      })}

      <g className="walls">
        {walls.map((rawWall) => {
          const wall = drag?.kind === "move-wall" && drag.id === rawWall.id ? drag.wall : rawWall;
          const selected = wall.id === selectedId;
          const focused = wall.id === project.view.focusElementId;
          return (
            <line
              key={wall.id}
              x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2}
              stroke={selected ? "#d65b32" : "#29362f"}
              strokeWidth={selected ? Math.max(0.62, wall.thickness) : wall.thickness}
              strokeLinecap="square"
              vectorEffect="non-scaling-stroke"
              filter={focused ? "url(#focus-glow)" : undefined}
              onPointerDown={(event) => handleWallPointerDown(event, wall)}
            />
          );
        })}
      </g>

      <g className="openings">
        {openings.map((opening) => {
          const geometry = openingGeometry(opening, walls);
          if (!geometry) return null;
          const focused = opening.id === project.view.focusElementId;
          return (
            <g
              key={opening.id}
              transform={`translate(${geometry.x} ${geometry.y}) rotate(${geometry.angle})`}
              filter={focused ? "url(#focus-glow)" : undefined}
              onPointerDown={(event) => { event.stopPropagation(); onSelect(opening.id); }}
              className={`opening opening--${opening.kind}`}
            >
              <line x1={-opening.width / 2} y1="0" x2={opening.width / 2} y2="0" stroke="#f7f5f0" strokeWidth="0.78" />
              {opening.kind === "window" ? (
                <>
                  <line x1={-opening.width / 2} y1="-0.13" x2={opening.width / 2} y2="-0.13" stroke="#4e8390" strokeWidth="0.12" />
                  <line x1={-opening.width / 2} y1="0.13" x2={opening.width / 2} y2="0.13" stroke="#4e8390" strokeWidth="0.12" />
                </>
              ) : (
                <>
                  <line x1={-opening.width / 2} y1="0" x2={opening.width / 2} y2={-opening.width} stroke="#6d5549" strokeWidth="0.12" />
                  <path d={`M ${-opening.width / 2} 0 A ${opening.width} ${opening.width} 0 0 1 ${opening.width / 2} ${-opening.width}`} fill="none" stroke="#9b7a68" strokeWidth="0.08" strokeDasharray="0.28 0.18" />
                </>
              )}
            </g>
          );
        })}
      </g>

      {stairs.map((stair) => (
        <g key={stair.id} className="stair" onPointerDown={(event) => { event.stopPropagation(); onSelect(stair.id); }}>
          <rect x={stair.x} y={stair.y} width={stair.width} height={stair.length} />
          {Array.from({ length: 8 }).map((_, index) => (
            <line key={index} x1={stair.x} y1={stair.y + (index + 1) * stair.length / 9} x2={stair.x + stair.width} y2={stair.y + (index + 1) * stair.length / 9} />
          ))}
          <line x1={stair.x + stair.width / 2} y1={stair.y + stair.length - 0.7} x2={stair.x + stair.width / 2} y2={stair.y + 0.8} className="stair-arrow" />
          <path d={`M ${stair.x + stair.width / 2} ${stair.y + 0.5} l -0.4 0.8 h 0.8 z`} fill="#45534b" />
        </g>
      ))}

      {previewWall && (
        <g pointerEvents="none">
          <line x1={previewWall.start.x} y1={previewWall.start.y} x2={previewWall.current.x} y2={previewWall.current.y} className="preview-wall" />
          <text x={(previewWall.start.x + previewWall.current.x) / 2} y={(previewWall.start.y + previewWall.current.y) / 2 - 0.8} textAnchor="middle" className="measurement-text">
            {round(Math.hypot(previewWall.current.x - previewWall.start.x, previewWall.current.y - previewWall.start.y), 1)}&apos;
          </text>
        </g>
      )}

      {activeMeasurement && (
        <g className="measurement" pointerEvents="none">
          <line x1={activeMeasurement.start.x} y1={activeMeasurement.start.y} x2={activeMeasurement.end.x} y2={activeMeasurement.end.y} />
          <circle cx={activeMeasurement.start.x} cy={activeMeasurement.start.y} r="0.22" />
          <circle cx={activeMeasurement.end.x} cy={activeMeasurement.end.y} r="0.22" />
          <text x={(activeMeasurement.start.x + activeMeasurement.end.x) / 2} y={(activeMeasurement.start.y + activeMeasurement.end.y) / 2 - 0.8} textAnchor="middle" className="measurement-text">
            {round(Math.hypot(activeMeasurement.end.x - activeMeasurement.start.x, activeMeasurement.end.y - activeMeasurement.start.y), 2)} ft
          </text>
        </g>
      )}

      {!rooms.length && !walls.length && (
        <g className="empty-plan" pointerEvents="none">
          <circle cx={project.plot.width / 2} cy={project.plot.length / 2 - 2} r="2.2" />
          <path d={`M ${project.plot.width / 2 - 0.8} ${project.plot.length / 2 - 2} h 1.6 M ${project.plot.width / 2} ${project.plot.length / 2 - 2.8} v 1.6`} />
          <text x={project.plot.width / 2} y={project.plot.length / 2 + 1.8} textAnchor="middle" className="empty-title">Your plot is ready</text>
          <text x={project.plot.width / 2} y={project.plot.length / 2 + 3.4} textAnchor="middle" className="empty-subtitle">Choose a room type, then click inside the site</text>
        </g>
      )}

      {selectedRoom && (
        <text x="0" y={project.plot.length + 6.5} className="selection-footer">
          SELECTED · {selectedRoom.name.toUpperCase()} · {selectedRoom.width}&apos; × {selectedRoom.length}&apos; · {roomArea(selectedRoom)} SQ FT
        </text>
      )}
    </svg>
  );
}
