"use client";

import { CircleAlert, ChevronRight } from "lucide-react";
import type { Project, ValidationIssue } from "@/lib/architecture";

const titles: Partial<Record<ValidationIssue["code"], string>> = {
  ROOM_OVERLAP: "Rooms overlap", OUTSIDE_PLOT: "Outside the land boundary", SETBACK_VIOLATION: "Review planning setbacks",
  INVALID_OPENING: "Opening does not fit", NO_ROOM_ACCESS: "Room needs a doorway", NO_EXTERIOR_ACCESS: "Home needs an entrance",
  DISCONNECTED_CIRCULATION: "Rooms are disconnected", INVALID_STAIR_CONNECTION: "Stair connection needs attention",
  INVALID_STAIR_GEOMETRY: "Review stair geometry", STAIR_ACCESS_CLEARANCE: "Stair approach needs space", STAIR_WALL_CLASH: "Stair clashes with a wall",
  DOOR_BLOCKED_BY_STAIR: "Stair blocks a door", OPENING_WITHOUT_ADJACENCY: "Review opening connection", OPENING_OVERLAP: "Openings overlap",
  WALL_OUTSIDE_PLOT: "Wall is outside the land", ROOM_BELOW_HABITABLE_MINIMUM: "Review room size", ROOM_DAYLIGHT_SHORTFALL: "Review daylight",
  ROOM_NO_VENTILATION: "Review natural ventilation", BEDROOM_NO_EGRESS: "Review bedroom escape route", BEDROOM_EGRESS_UNVERIFIED: "Confirm clear escape opening",
  INVALID_BALCONY: "Review balcony or terrace", INVALID_SITE_BOUNDARY: "Review boundary wall and gate", INVALID_FACADE_FEATURE: "Review façade feature",
};
export function issueTitle(issue: ValidationIssue) {
  return titles[issue.code] ?? issue.code.toLowerCase().replaceAll("_", " ");
}
export function issueContext(project: Project, issue: ValidationIssue) {
  const rooms = project.rooms.filter((room) => issue.elementIds.includes(room.id) || issue.affectedRoomIds?.includes(room.id));
  if (rooms.length) return rooms.map((room) => `${room.name} · ${project.floors.find((floor) => floor.id === room.floorId)?.name ?? "Floor"}`).join(" / ");
  return issue.elementIds.length ? "Selected architectural elements" : "Home and site";
}
export function IssueEvidence({ issue, elements }: { issue: ValidationIssue; elements: string }) {
  return <details className="issue-evidence architectural-details"><summary>Architectural evidence</summary>
    <p className="technical-note">{elements || "Home and site"}</p>
    <dl>{Object.entries(issue.evidence).map(([key, value]) => <div key={key}><dt>{key.replace(/([A-Z])/g, " $1").toLowerCase()}</dt><dd>{String(value)}</dd></div>)}</dl>
    <small>{issue.code}{issue.possibleCorrection ? ` · ${issue.possibleCorrection}` : ""}</small>
  </details>;
}
export default function GroupedChecks({ project, issues, onFocus, elementLabel }: {
  project: Project; issues: ValidationIssue[]; onFocus: (id: string) => void; elementLabel: (id: string) => string;
}) {
  const groups = new Map<string, ValidationIssue[]>();
  for (const issue of issues) { const key = `${issue.severity}:${issue.code}`; groups.set(key, [...(groups.get(key) ?? []), issue]); }
  return <div className="grouped-checks">{[...groups.entries()].sort(([, a], [, b]) => Number(b[0].severity === "error") - Number(a[0].severity === "error")).map(([key, group]) => <details className="check-group" key={key} open={group[0].severity === "error"}>
    <summary><span className={`issue-severity ${group[0].severity}`}><CircleAlert size={14} /></span><b>{issueTitle(group[0])}</b><em>{group.length}</em></summary>
    <div className="issue-list">{group.map((issue) => <div className="issue-entry" key={issue.id}>
      <button type="button" onClick={() => onFocus(issue.id)}><div><strong>{issueContext(project, issue)}</strong><p>{issue.message}</p><small>{issue.suggestion}</small></div><ChevronRight size={16} /></button>
      <IssueEvidence issue={issue} elements={issue.elementIds.map(elementLabel).join(" + ")} />
    </div>)}</div>
  </details>)}</div>;
}
