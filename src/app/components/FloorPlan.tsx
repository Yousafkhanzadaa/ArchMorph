"use client";

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import {
  type Opening,
  type Project,
  type Room,
  type RoomType,
  type Stair,
  type Wall,
  round,
  roomArea,
  roomBounds,
  roomCentroid,
  roomVertices,
  stairConnection,
  stairAccessPolygon,
  stairFootprint,
  stairLayout,
  stairPlanFlightCorners,
  stairPlanOutline,
  stairPlanPoint,
  wallLength,
} from "@/lib/architecture";

export type CanvasTool = "select" | "room" | "wall" | "door" | "window" | "stair" | "measure";

type Point = { x: number; y: number };
type DragState =
  | { kind: "move-room"; id: string; start: Point; origin: Point; room: Room }
  | { kind: "resize-room"; id: string; room: Room }
  | { kind: "edit-room-vertex"; id: string; vertexIndex: number; room: Room }
  | { kind: "move-wall"; id: string; start: Point; origin: Wall; wall: Wall }
  | { kind: "move-stair"; id: string; start: Point; origin: Stair; stair: Stair }
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
  onUpdateRoomVertices: (id: string, vertices: Point[]) => void;
  onAddWall: (start: Point, end: Point) => void;
  onMoveWall: (id: string, dx: number, dy: number) => void;
  onAddOpening: (kind: "door" | "window", wallId: string, offset: number) => void;
  onRemoveOpening: (openingId: string) => void;
  onAddStair: (point: Point) => void;
  onMoveStair: (id: string, x: number, y: number) => void;
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
  onUpdateRoomVertices,
  onAddWall,
  onMoveWall,
  onAddOpening,
  onRemoveOpening,
  onAddStair,
  onMoveStair,
}: FloorPlanProps) {
  const [drag, setDrag] = useState<DragState>();
  const [alignmentGuides, setAlignmentGuides] = useState<{ vertical?: number; horizontal?: number }>({});
  const [measurement, setMeasurement] = useState<{ start: Point; end: Point }>();
  const localSvgRef = useRef<SVGSVGElement | null>(null);
  const floorId = project.view.activeFloorId;
  const rooms = project.rooms.filter((room) => room.floorId === floorId);
  const walls = project.walls.filter((wall) => wall.floorId === floorId);
  const openings = project.openings.filter((opening) => opening.floorId === floorId);
  const stairs = project.stairs.filter((stair) => stair.floorId === floorId);
  const balconies = project.balconies.filter((balcony) => balcony.floorId === floorId);
  const facadeFeatures = project.facadeFeatures.filter((feature) => walls.some((wall) => wall.id === feature.wallId));
  const linkedStairs = project.stairs.filter((stair) => {
    const connection = stairConnection(project, stair);
    return connection?.targetFloor.id === floorId && stair.floorId !== floorId;
  });
  const northRotation = { North: 0, East: -90, South: 180, West: 90 }[project.plot.orientation];
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
    if (drag?.kind === "edit-room-vertex" && drag.id === room.id) return drag.room;
    return room;
  };

  const alignRoom = (room: Room) => {
    const otherRooms = rooms.filter((item) => item.id !== room.id);
    const verticalEdges = otherRooms.flatMap((item) => [item.x, item.x + item.width]);
    const horizontalEdges = otherRooms.flatMap((item) => [item.y, item.y + item.length]);
    let x = room.x;
    let y = room.y;
    let vertical: number | undefined;
    let horizontal: number | undefined;
    const xMatches = verticalEdges.flatMap((edge) => [
      { delta: edge - room.x, edge },
      { delta: edge - (room.x + room.width), edge },
    ]).filter((item) => Math.abs(item.delta) <= 0.4).sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta));
    const yMatches = horizontalEdges.flatMap((edge) => [
      { delta: edge - room.y, edge },
      { delta: edge - (room.y + room.length), edge },
    ]).filter((item) => Math.abs(item.delta) <= 0.4).sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta));
    if (xMatches[0]) { x += xMatches[0].delta; vertical = xMatches[0].edge; }
    if (yMatches[0]) { y += yMatches[0].delta; horizontal = yMatches[0].edge; }
    setAlignmentGuides({ vertical, horizontal });
    const dx = snap(x) - room.x;
    const dy = snap(y) - room.y;
    return { ...room, x: snap(x), y: snap(y), vertices: room.vertices?.map((point) => ({ x: point.x + dx, y: point.y + dy })) };
  };

  const alignWallPoint = (point: Point, start: Point) => {
    const endpoints = walls.flatMap((wall) => [{ x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 }]);
    const nearest = endpoints
      .map((endpoint) => ({ endpoint, distance: Math.hypot(endpoint.x - point.x, endpoint.y - point.y) }))
      .filter((item) => item.distance <= 0.55)
      .sort((a, b) => a.distance - b.distance)[0];
    let current = nearest?.endpoint ?? point;
    const dx = current.x - start.x;
    const dy = current.y - start.y;
    if (Math.abs(dx) > Math.abs(dy) * 2.5) current = { x: current.x, y: start.y };
    else if (Math.abs(dy) > Math.abs(dx) * 2.5) current = { x: start.x, y: current.y };
    else if (!nearest) {
      const length = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
      const angleDelta = Math.abs(Math.atan2(Math.sin(angle - snappedAngle), Math.cos(angle - snappedAngle)));
      if (length > 0 && angleDelta <= Math.PI / 18) {
        current = { x: start.x + Math.cos(snappedAngle) * length, y: start.y + Math.sin(snappedAngle) * length };
      }
    }
    setAlignmentGuides({ vertical: current.x === start.x ? start.x : undefined, horizontal: current.y === start.y ? start.y : undefined });
    return { x: snap(current.x), y: snap(current.y) };
  };

  const handleBackgroundPointerDown = (event: ReactPointerEvent<SVGRectElement>) => {
    const point = toPoint(event);
    onSelect(undefined);
    if (tool === "room") onCreateRoom(point, roomType);
    if (tool === "stair") onAddStair(point);
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

  const handleStairPointerDown = (event: ReactPointerEvent<SVGGElement>, stair: Stair, linked: boolean) => {
    event.stopPropagation();
    onSelect(stair.id);
    if (tool !== "select" || linked) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ kind: "move-stair", id: stair.id, start: toPoint(event), origin: stair, stair });
  };

  const handleRoomPointerDown = (event: ReactPointerEvent<SVGElement>, room: Room) => {
    if (tool === "stair") {
      event.stopPropagation();
      onSelect(undefined);
      onAddStair(toPoint(event));
      return;
    }
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
    setDrag({ kind: "resize-room", id: room.id, room });
  };

  const handleVertexPointerDown = (event: ReactPointerEvent<SVGCircleElement>, room: Room, vertexIndex: number) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ kind: "edit-room-vertex", id: room.id, vertexIndex, room });
  };

  const handleWallPointerDown = (event: ReactPointerEvent<SVGLineElement>, wall: Wall) => {
    event.stopPropagation();
    const point = toPoint(event);
    if (tool === "door" || tool === "window") {
      const length = wallLength(wall);
      const dx = wall.x2 - wall.x1;
      const dy = wall.y2 - wall.y1;
      const offset = length ? ((point.x - wall.x1) * dx + (point.y - wall.y1) * dy) / length : 0;
      const centeredOffset = Math.abs(offset - length / 2) <= 0.5 ? length / 2 : snap(offset);
      onAddOpening(tool, wall.id, Math.max(tool === "door" ? 1.5 : 2, centeredOffset));
      return;
    }
    if (tool === "select") {
      onSelect(wall.id);
      if (!wall.roomIds.length) {
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
      const translated = { ...drag.room, x, y, vertices: drag.room.vertices?.map((vertex) => ({ x: vertex.x + x - drag.room.x, y: vertex.y + y - drag.room.y })) };
      setDrag({ ...drag, room: alignRoom(translated) });
    } else if (drag.kind === "resize-room") {
      let width = Math.max(3, Math.min(project.plot.width - drag.room.x, snap(point.x - drag.room.x)));
      let length = Math.max(3, Math.min(project.plot.length - drag.room.y, snap(point.y - drag.room.y)));
      const otherRooms = rooms.filter((item) => item.id !== drag.id);
      const vertical = otherRooms.flatMap((item) => [item.x, item.x + item.width]).map((edge) => ({ edge, delta: edge - (drag.room.x + width) })).filter((item) => Math.abs(item.delta) <= 0.4).sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))[0];
      const horizontal = otherRooms.flatMap((item) => [item.y, item.y + item.length]).map((edge) => ({ edge, delta: edge - (drag.room.y + length) })).filter((item) => Math.abs(item.delta) <= 0.4).sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))[0];
      if (vertical) width = snap(width + vertical.delta);
      if (horizontal) length = snap(length + horizontal.delta);
      setAlignmentGuides({ vertical: vertical?.edge, horizontal: horizontal?.edge });
      setDrag({ ...drag, room: { ...drag.room, width, length } });
    } else if (drag.kind === "edit-room-vertex") {
      const vertices = roomVertices(drag.room);
      const index = drag.vertexIndex;
      const previousIndex = (index - 1 + vertices.length) % vertices.length;
      const nextIndex = (index + 1) % vertices.length;
      const previous = vertices[previousIndex];
      const current = vertices[index];
      const next = vertices[nextIndex];
      const moved = { x: Math.max(0, Math.min(project.plot.width, point.x)), y: Math.max(0, Math.min(project.plot.length, point.y)) };
      vertices[index] = moved;
      vertices[previousIndex] = Math.abs(previous.y - current.y) < 0.01 ? { ...previous, y: moved.y } : { ...previous, x: moved.x };
      vertices[nextIndex] = Math.abs(next.y - current.y) < 0.01 ? { ...next, y: moved.y } : { ...next, x: moved.x };
      const bounds = roomBounds({ ...drag.room, vertices });
      setDrag({ ...drag, room: { ...drag.room, ...bounds, shape: "custom", vertices } });
    } else if (drag.kind === "draw-wall" || drag.kind === "measure") {
      setDrag({ ...drag, current: drag.kind === "draw-wall" ? alignWallPoint(point, drag.start) : point });
    } else if (drag.kind === "move-wall") {
      const dx = point.x - drag.start.x;
      const dy = point.y - drag.start.y;
      setDrag({ ...drag, wall: {
        ...drag.origin,
        x1: snap(drag.origin.x1 + dx), y1: snap(drag.origin.y1 + dy),
        x2: snap(drag.origin.x2 + dx), y2: snap(drag.origin.y2 + dy),
      } });
    } else if (drag.kind === "move-stair") {
      const dx = point.x - drag.start.x;
      const dy = point.y - drag.start.y;
      const footprint = stairFootprint(drag.stair);
      const x = Math.max(0, Math.min(project.plot.width - footprint.width, snap(drag.origin.x + dx)));
      const y = Math.max(0, Math.min(project.plot.length - footprint.length, snap(drag.origin.y + dy)));
      setDrag({ ...drag, stair: { ...drag.origin, x, y } });
    }
  };

  const finishPointerAction = () => {
    if (!drag) return;
    if (drag.kind === "move-room" && (drag.room.x !== drag.origin.x || drag.room.y !== drag.origin.y)) {
      onMoveRoom(drag.id, { x: drag.room.x, y: drag.room.y });
    }
    if (drag.kind === "resize-room" && (drag.room.width !== project.rooms.find((room) => room.id === drag.id)?.width || drag.room.length !== project.rooms.find((room) => room.id === drag.id)?.length)) {
      onResizeRoom(drag.id, drag.room.width, drag.room.length);
    }
    if (drag.kind === "edit-room-vertex") onUpdateRoomVertices(drag.id, roomVertices(drag.room));
    if (drag.kind === "draw-wall" && Math.hypot(drag.current.x - drag.start.x, drag.current.y - drag.start.y) >= 1) {
      onAddWall(drag.start, drag.current);
    }
    if (drag.kind === "move-wall" && (drag.wall.x1 !== drag.origin.x1 || drag.wall.y1 !== drag.origin.y1 || drag.wall.x2 !== drag.origin.x2 || drag.wall.y2 !== drag.origin.y2)) {
      onMoveWall(drag.id, drag.wall.x1 - drag.origin.x1, drag.wall.y1 - drag.origin.y1);
    }
    if (drag.kind === "move-stair" && (drag.stair.x !== drag.origin.x || drag.stair.y !== drag.origin.y)) {
      onMoveStair(drag.id, drag.stair.x, drag.stair.y);
    }
    if (drag.kind === "measure") setMeasurement({ start: drag.start, end: drag.current });
    setDrag(undefined);
    setAlignmentGuides({});
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
      onPointerCancel={() => { setDrag(undefined); setAlignmentGuides({}); }}
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

      {project.siteBoundary.enabled && (
        <g className="site-boundary" pointerEvents="none" fill="none" stroke="#665d53" strokeWidth={Math.max(0.18, project.siteBoundary.thickness)}>
          <line x1="0" y1="0" x2="0" y2={project.plot.length} />
          <line x1={project.plot.width} y1="0" x2={project.plot.width} y2={project.plot.length} />
          <line x1="0" y1={project.plot.length} x2={project.plot.width} y2={project.plot.length} />
          {project.siteBoundary.gate.enabled ? <>
            <line x1="0" y1="0" x2={project.siteBoundary.gate.offset - project.siteBoundary.gate.width / 2} y2="0" />
            <line x1={project.siteBoundary.gate.offset + project.siteBoundary.gate.width / 2} y1="0" x2={project.plot.width} y2="0" />
            <line x1={project.siteBoundary.gate.offset - project.siteBoundary.gate.width / 2} y1="-0.3" x2={project.siteBoundary.gate.offset + project.siteBoundary.gate.width / 2} y2="-0.3" stroke="#47544c" strokeWidth="0.16" strokeDasharray={project.siteBoundary.gate.style === "slatted" ? "0.35 0.22" : undefined} />
          </> : <line x1="0" y1="0" x2={project.plot.width} y2="0" />}
        </g>
      )}

      <g className="alignment-guides" pointerEvents="none">
        {alignmentGuides.vertical !== undefined && <line x1={alignmentGuides.vertical} y1="0" x2={alignmentGuides.vertical} y2={project.plot.length} />}
        {alignmentGuides.horizontal !== undefined && <line x1="0" y1={alignmentGuides.horizontal} x2={project.plot.width} y2={alignmentGuides.horizontal} />}
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

      <g className="north-arrow" transform={`translate(${project.plot.width + 5.3} 5) rotate(${northRotation})`} pointerEvents="none">
        <text x="0" y="-2.1" textAnchor="middle">N</text>
        <path d="M0,-1.5 L-0.75,1.5 L0,0.95 L0.75,1.5 Z" fill="#25322b" />
      </g>

      <g className="balconies">
        {balconies.map((balcony) => {
          const selected = selectedId === balcony.id;
          const sideLine = (side: "north" | "east" | "south" | "west") => side === "north"
            ? { x1: balcony.x, y1: balcony.y, x2: balcony.x + balcony.width, y2: balcony.y }
            : side === "south"
              ? { x1: balcony.x, y1: balcony.y + balcony.length, x2: balcony.x + balcony.width, y2: balcony.y + balcony.length }
              : side === "west"
                ? { x1: balcony.x, y1: balcony.y, x2: balcony.x, y2: balcony.y + balcony.length }
                : { x1: balcony.x + balcony.width, y1: balcony.y, x2: balcony.x + balcony.width, y2: balcony.y + balcony.length };
          return <g key={balcony.id} onPointerDown={(event) => { event.stopPropagation(); onSelect(balcony.id); }}>
            <title>{balcony.name} · {balcony.width} × {balcony.length} ft</title>
            <rect x={balcony.x} y={balcony.y} width={balcony.width} height={balcony.length} fill="#c8c1b3" fillOpacity="0.38" stroke={selected ? "#d65b32" : "#786f63"} strokeWidth={selected ? 0.3 : 0.12} />
            {balcony.railing.enabled && balcony.railing.sides.map((side) => <line key={side} {...sideLine(side)} stroke="#52635b" strokeWidth="0.2" strokeDasharray={balcony.railing.style === "solid" ? undefined : "0.45 0.25"} />)}
            <text x={balcony.x + balcony.width / 2} y={balcony.y + balcony.length / 2 + 0.25} textAnchor="middle" fontSize="0.68" fontWeight="700" pointerEvents="none">{balcony.kind.toUpperCase()}</text>
          </g>;
        })}
      </g>

      {rooms.map((rawRoom) => {
        const room = roomForRender(rawRoom);
        const selected = room.id === selectedId;
        const focused = room.id === project.view.focusElementId;
        const area = roomArea(room);
        const vertices = roomVertices(room);
        const centroid = roomCentroid(room);
        const compactLabel = !selected && (room.width < 7 || room.length < 6 || area < 55);
        const mediumLabel = !selected && !compactLabel && (room.width < 10 || room.length < 8 || area < 90);
        const visibleName = roomLabel(room).length > 18 && !selected ? `${roomLabel(room).slice(0, 16)}…` : roomLabel(room);
        return (
          <g key={room.id} className={`room-group ${selected ? "is-selected" : ""}`}>
            <title>{room.name} · {area} sq ft · {room.width} × {room.length} ft</title>
            <polygon
              points={vertices.map((point) => `${point.x},${point.y}`).join(" ")}
              fill={room.color} fillOpacity={room.type === "Courtyard" ? 0.34 : 0.72}
              stroke={selected ? "#d65b32" : "#35423a"} strokeWidth={selected ? 0.28 : 0.08}
              strokeDasharray={room.type === "Courtyard" ? "0.7 0.4" : undefined}
              filter={focused ? "url(#focus-glow)" : "url(#room-shadow)"}
              vectorEffect="non-scaling-stroke"
              onPointerDown={(event) => handleRoomPointerDown(event, room)}
            />
            <g pointerEvents="none" className="room-label">
              <text x={centroid.x} y={centroid.y + (compactLabel ? 0.3 : -0.35)} textAnchor="middle" className={`room-name ${compactLabel ? "is-compact" : ""}`}>{visibleName}</text>
              {!compactLabel && <text x={centroid.x} y={centroid.y + 1.05} textAnchor="middle" className="room-area">{area} sq ft</text>}
              {!compactLabel && !mediumLabel && <text x={room.x + room.width / 2} y={room.y + room.length - 0.65} textAnchor="middle" className="room-size">{room.width}&apos; × {room.length}&apos;</text>}
            </g>
            {selected && (
              <>
                <line x1={room.x} y1={room.y - 0.65} x2={room.x + room.width} y2={room.y - 0.65} className="selection-dimension" pointerEvents="none" />
                <text x={room.x + room.width / 2} y={room.y - 1} textAnchor="middle" className="selection-dimension-text" pointerEvents="none">{room.width}&apos;–0&quot;</text>
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
            <g key={wall.id} className="wall">
              <line
                x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2}
                className="wall-hit-target"
                vectorEffect="non-scaling-stroke"
                onPointerDown={(event) => handleWallPointerDown(event, wall)}
              />
              <line
                x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2}
                className="wall-visible"
                stroke={selected ? "#d65b32" : "#29362f"}
                strokeWidth={selected ? Math.max(0.62, wall.thickness) : wall.thickness}
                strokeLinecap="square"
                filter={focused ? "url(#focus-glow)" : undefined}
                pointerEvents="none"
              />
            </g>
          );
        })}
      </g>

      {project.roof.parapetEnabled && project.floors.find((floor) => floor.id === floorId)?.level === Math.max(...project.floors.map((floor) => floor.level)) && (
        <g className="parapets" pointerEvents="none">
          {walls.filter((wall) => wall.exterior).map((wall) => <line key={wall.id} x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2} stroke="#70675d" strokeWidth={Math.max(0.18, project.roof.parapetThickness)} strokeDasharray="0.65 0.3" />)}
        </g>
      )}

      <g className="facade-features">
        {facadeFeatures.map((feature) => {
          const wall = walls.find((item) => item.id === feature.wallId);
          if (!wall) return null;
          const length = wallLength(wall);
          const tx = (wall.x2 - wall.x1) / length;
          const ty = (wall.y2 - wall.y1) / length;
          const center = { x: wall.x1 + tx * feature.offset, y: wall.y1 + ty * feature.offset };
          const side = wall.roomSides[0]?.side;
          const normal = side === "north" ? { x: 0, y: -1 } : side === "south" ? { x: 0, y: 1 } : side === "east" ? { x: 1, y: 0 } : { x: -1, y: 0 };
          const projection = feature.kind === "frame" ? feature.projection / 2 : feature.projection;
          const x1 = center.x - tx * feature.width / 2 + normal.x * projection;
          const y1 = center.y - ty * feature.width / 2 + normal.y * projection;
          const x2 = center.x + tx * feature.width / 2 + normal.x * projection;
          const y2 = center.y + ty * feature.width / 2 + normal.y * projection;
          return <line key={feature.id} x1={x1} y1={y1} x2={x2} y2={y2} stroke={selectedId === feature.id ? "#d65b32" : "#866d55"} strokeWidth={selectedId === feature.id ? 0.4 : Math.max(0.18, feature.thickness)} strokeLinecap="square" onPointerDown={(event) => { event.stopPropagation(); onSelect(feature.id); }}><title>{feature.kind} · {feature.width} ft</title></line>;
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
              onPointerDown={(event) => {
                event.stopPropagation();
                if (tool === opening.kind) onRemoveOpening(opening.id);
                else onSelect(opening.id);
              }}
              className={`opening opening--${opening.kind}`}
            >
              <rect
                x={-opening.width / 2 - 0.45}
                y="-0.9"
                width={opening.width + 0.9}
                height="1.8"
                className="opening-hit-target"
              />
              <line x1={-opening.width / 2} y1="0" x2={opening.width / 2} y2="0" stroke="#f7f5f0" strokeWidth="0.78" />
              {opening.kind === "window" ? (
                <>
                  <line x1={-opening.width / 2} y1="-0.13" x2={opening.width / 2} y2="-0.13" stroke="#4e8390" strokeWidth="0.12" />
                  <line x1={-opening.width / 2} y1="0.13" x2={opening.width / 2} y2="0.13" stroke="#4e8390" strokeWidth="0.12" />
                  {opening.windowType === "sliding" && <line x1="0" y1="-0.3" x2="0" y2="0.3" stroke="#4e8390" strokeWidth="0.09" />}
                </>
              ) : (
                (() => {
                  const hingeX = opening.hingeSide === "end" ? opening.width / 2 : -opening.width / 2;
                  const closedEndX = -hingeX;
                  const swingSign = (opening.swingDirection === "outward" ? 1 : -1) * (opening.handing === "right" ? -1 : 1);
                  const openEndY = swingSign * opening.width;
                  const isClosed = opening.state === "closed";
                  return <>
                    <line x1={hingeX} y1="0" x2={isClosed ? closedEndX : hingeX} y2={isClosed ? 0 : openEndY} stroke="#6d5549" strokeWidth="0.12" />
                    {!isClosed && <path d={`M ${closedEndX} 0 A ${opening.width} ${opening.width} 0 0 ${swingSign > 0 ? 1 : 0} ${hingeX} ${openEndY}`} fill="none" stroke="#9b7a68" strokeWidth="0.08" strokeDasharray="0.28 0.18" />}
                  </>;
                })()
              )}
            </g>
          );
        })}
      </g>

      {[...stairs.map((stair) => ({ stair, linked: false })), ...linkedStairs.map((stair) => ({ stair, linked: true }))].map(({ stair: rawStair, linked }) => {
        const stair = drag?.kind === "move-stair" && drag.id === rawStair.id ? drag.stair : rawStair;
        const connection = stairConnection(project, stair);
        const atLowerFloor = connection ? connection.lowerFloor.id === floorId : stair.direction === "up";
        const arrowUp = atLowerFloor;
        const layout = stairLayout(stair);
        const outline = stairPlanOutline(stair);
        const localPath = arrowUp ? layout.route : [...layout.route].reverse();
        const path = localPath.map((point) => stairPlanPoint(stair, point.u, point.v));
        const head = path[path.length - 1];
        const previousHead = path[path.length - 2];
        const headLength = Math.max(0.001, Math.hypot(head.x - previousHead.x, head.y - previousHead.y));
        const hx = (head.x - previousHead.x) / headLength;
        const hy = (head.y - previousHead.y) / headLength;
        const left = { x: head.x - hx * 0.45 - hy * 0.32, y: head.y - hy * 0.45 + hx * 0.32 };
        const right = { x: head.x - hx * 0.45 + hy * 0.32, y: head.y - hy * 0.45 - hx * 0.32 };
        const labelRoutePoint = localPath[Math.min(1, localPath.length - 1)];
        const center = stairPlanPoint(stair, labelRoutePoint.u, labelRoutePoint.v);
        const access = stairAccessPolygon(stair, atLowerFloor ? "lower" : "upper");
        const currentFlightId = atLowerFloor ? layout.flights[0].id : layout.flights[layout.flights.length - 1].id;
        const stairName = stair.stairType === "u-shaped" ? "U-shaped half-turn stair" : stair.stairType === "l-shaped" ? "L-shaped quarter-turn stair" : "Straight stair";
        return (
          <g
            key={`${stair.id}:${linked ? "linked" : "owned"}`}
            className={`stair ${linked ? "is-linked" : ""} ${atLowerFloor ? "is-lower-plan" : "is-upper-plan"} ${selectedId === stair.id ? "is-selected" : ""}`}
            onPointerDown={(event) => handleStairPointerDown(event, stair, linked)}
          >
            <title>{stairName} · {atLowerFloor ? "lower-floor UP plan" : "upper-floor DN plan"} · {connection?.lowerFloor.name ?? "Unconnected"} to {connection?.upperFloor.name ?? "adjacent floor"}</title>
            <polygon className="stair-access-zone" points={access.map((point) => `${point.x},${point.y}`).join(" ")} />
            <polygon className="stair-footprint" points={outline.map((point) => `${point.x},${point.y}`).join(" ")} />
            {layout.landing && <polygon className="stair-landing" points={layout.landing.vertices.map((point) => stairPlanPoint(stair, point.u, point.v)).map((point) => `${point.x},${point.y}`).join(" ")} />}
            {layout.flights.map((flight, flightIndex) => {
              const corners = stairPlanFlightCorners(stair, flight);
              const treadCount = Math.min(14, Math.max(5, connection?.treadsPerFlight[flightIndex] ?? 7));
              const current = flight.id === currentFlightId;
              const crossSection = (ratio: number) => ({
                a: { x: corners[0].x + (corners[1].x - corners[0].x) * ratio, y: corners[0].y + (corners[1].y - corners[0].y) * ratio },
                b: { x: corners[3].x + (corners[2].x - corners[3].x) * ratio, y: corners[3].y + (corners[2].y - corners[3].y) * ratio },
              });
              const cutBase = atLowerFloor ? 0.55 : 0.39;
              const cutA = crossSection(cutBase);
              const cutB = crossSection(cutBase + 0.05);
              const cutC = crossSection(cutBase + 0.09);
              const cutD = crossSection(cutBase + 0.14);
              return <g key={flight.id} className={`stair-flight ${current ? "is-current" : "is-beyond-cut"}`}>
                <polygon points={corners.map((point) => `${point.x},${point.y}`).join(" ")} />
                {Array.from({ length: treadCount }).map((_, index) => {
                  const line = crossSection((index + 1) / (treadCount + 1));
                  return <line key={index} x1={line.a.x} y1={line.a.y} x2={line.b.x} y2={line.b.y} />;
                })}
                {current && <g className="stair-cut-line">
                  <line x1={cutA.a.x} y1={cutA.a.y} x2={cutB.b.x} y2={cutB.b.y} />
                  <line x1={cutC.a.x} y1={cutC.a.y} x2={cutD.b.x} y2={cutD.b.y} />
                </g>}
              </g>;
            })}
            <polyline points={path.map((point) => `${point.x},${point.y}`).join(" ")} className="stair-arrow" />
            <path d={`M ${head.x} ${head.y} L ${left.x} ${left.y} L ${right.x} ${right.y} Z`} fill="#45534b" />
            <text x={center.x} y={center.y + 0.25} textAnchor="middle" className="stair-label">{arrowUp ? "UP" : "DN"}</text>
          </g>
        );
      })}

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

      {!rooms.length && !walls.length && !stairs.length && (
        <g className="empty-plan" pointerEvents="none">
          <circle cx={project.plot.width / 2} cy={project.plot.length / 2 - 2} r="2.2" />
          <path d={`M ${project.plot.width / 2 - 0.8} ${project.plot.length / 2 - 2} h 1.6 M ${project.plot.width / 2} ${project.plot.length / 2 - 2.8} v 1.6`} />
          <text x={project.plot.width / 2} y={project.plot.length / 2 + 1.8} textAnchor="middle" className="empty-title">Your plot is ready</text>
          <text x={project.plot.width / 2} y={project.plot.length / 2 + 3.4} textAnchor="middle" className="empty-subtitle">Choose a room type, then click inside the site</text>
        </g>
      )}

      {selectedRoom && (() => {
        const room = roomForRender(selectedRoom);
        const vertices = roomVertices(room);
        return (
          <g className="room-edit-handles">
            <circle
              cx={room.x + room.width} cy={room.y + room.length} r="0.52"
              className="resize-handle"
              onPointerDown={(event) => handleResizePointerDown(event, room)}
            />
            {(room.shape ?? "rectangle") !== "rectangle" && vertices.map((point, index) => (
              <circle key={`${room.id}-vertex-${index}`} cx={point.x} cy={point.y} r="0.42" className="resize-handle room-vertex-handle" onPointerDown={(event) => handleVertexPointerDown(event, room, index)} />
            ))}
          </g>
        );
      })()}

      {selectedRoom && (
        <text x="0" y={project.plot.length + 6.5} className="selection-footer">
          SELECTED · {selectedRoom.name.toUpperCase()} · {selectedRoom.width}&apos; × {selectedRoom.length}&apos; · {roomArea(selectedRoom)} SQ FT
        </text>
      )}
    </svg>
  );
}
