"use client";

import { useState } from "react";
import { roomTypes, type ArchitectureOperation, type Project, type RoomType } from "@/lib/architecture";
import { roomSplitCandidate, wallEnclosure } from "@/lib/wall-planning";

export default function WallSpaceActions({ project, wallId, onCommit }: { project: Project; wallId: string; onCommit: (operation: ArchitectureOperation) => string | undefined }) {
  const enclosure = wallEnclosure(project, wallId);
  const room = roomSplitCandidate(project, wallId);
  const [name, setName] = useState("New room");
  const [type, setType] = useState<RoomType>("Custom");
  const [error, setError] = useState<string>();
  if (!enclosure && !room) return <p className="technical-note">Independent walls stay editable. Close a simple orthogonal enclosure to create a room, or cross an entire rectangular room to split it.</p>;
  return <details className="wall-space-action architectural-details"><summary>{enclosure ? "Create room from enclosure" : `Split ${room!.name} with this partition`}</summary>
    {enclosure && <svg className="enclosure-preview" viewBox={`${Math.min(...enclosure.vertices.map(p => p.x)) - 1} ${Math.min(...enclosure.vertices.map(p => p.y)) - 1} ${Math.max(...enclosure.vertices.map(p => p.x)) - Math.min(...enclosure.vertices.map(p => p.x)) + 2} ${Math.max(...enclosure.vertices.map(p => p.y)) - Math.min(...enclosure.vertices.map(p => p.y)) + 2}`} role="img" aria-label={`Enclosure preview, ${enclosure.area} square feet`}><polygon points={enclosure.vertices.map(p => `${p.x},${p.y}`).join(" ")} fill="#dfe9dc" stroke="#3d5940" strokeWidth="0.2" /></svg>}
    <p className="technical-note">{enclosure ? `${enclosure.area} sq ft becomes a room with a floor slab and boundary walls. Existing wall IDs, thickness, finishes and valid openings are retained.` : "Creates two rooms and makes this partition their shared wall. Both sides keep at least 3 ft. Openings and finishes are retained; an opening crossing a new corner rejects the whole edit."} Undo restores the current design.</p>
    <form onSubmit={event => { event.preventDefault(); const failure = onCommit(enclosure ? { type: "create_room_from_walls", wallId, name, roomType: type } : { type: "split_room_with_wall", wallId, roomId: room!.id, name, roomType: type }); setError(failure); }}>
      <label className="field"><span>{enclosure ? "Room name" : "Second room name"}</span><input value={name} onChange={event => setName(event.target.value)} required /></label>
      {<label className="field"><span>Room type</span><select value={type} onChange={event => setType(event.target.value as RoomType)}>{roomTypes.map(t => <option key={t}>{t}</option>)}</select></label>}
      {error && <p className="field-error" role="alert">{error}</p>}
      <button type="submit" className="space-conversion-button">{enclosure ? "Create room and slab" : "Create two rooms"}</button>
    </form>
  </details>;
}
