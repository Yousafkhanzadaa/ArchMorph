# Habitability review, measurement honesty, and agent parity — 2026-08-30

This change closes the gaps found by an architectural review of the live application. No new
modelling subsystem was added; the work makes existing data answer questions it already could.

## 1. Validation now reviews habitability, not only geometry

Before this change `room.type` was carried through the whole schema and used only for plan colour
and courtyard exclusion. No validation rule read it, so a complete house containing a windowless,
unventilated bathroom returned `status: "pass", errors: 0, warnings: 0`.

Four checks now run over data the project already stored:

| Code | Rule | Basis |
| --- | --- | --- |
| `ROOM_BELOW_HABITABLE_MINIMUM` | Habitable rooms need ≥ 70 sq ft and a least dimension ≥ 7 ft | 2021 IRC R304 concept |
| `ROOM_DAYLIGHT_SHORTFALL` | Habitable rooms need exterior glazing ≥ 8% of floor area | 2021 IRC R303.1 concept |
| `ROOM_NO_VENTILATION` | Habitable rooms and bathrooms need openable glazing ≥ 4% of floor area | 2021 IRC R303.1 concept |
| `BEDROOM_NO_EGRESS` | Bedrooms need one window ≥ 5.7 sq ft clear, ≥ 20 in wide, ≥ 24 in high, sill ≤ 44 in | 2021 IRC R310 concept |

Details that make the findings architecturally credible:

- Only walls that can actually admit light and air count: exterior walls, plus walls facing an open
  courtyard. An interior window does not satisfy daylight.
- Openable area is derived from the window's operating type — fixed 0, casement 0.9, sliding 0.5,
  awning 0.6 — so a fixed sash correctly admits light but no air.
- Storage, garages, courtyards, and unclassified spaces are exempt.
- All four are **warnings** carrying their threshold, basis, and a suggested correction. They are
  early-design guidance with stated assumptions, never a code-compliance determination.

The included sample residence now reports two genuine findings: `Modern Kitchen` is a fully internal
room with no exterior wall, so it fails both daylight and ventilation. That is a real defect in the
plan, not a false positive.

## 2. Measurement labels now match what is measured

`netRoomArea` was documented as "excluding wall thickness" while it measured to wall centrelines,
overstating finished area by roughly 8–10% and worst on small rooms.

- `carpetArea` was added, measured to the inside face of the bounding walls. It is exact for
  orthogonal rooms of uniform wall thickness: each convex corner adds t²/4, each reflex corner
  removes it. Verified against hand-computed insets for both a rectangle and an L-shaped room.
- `netRoomArea` keeps its key and value but is now described honestly as a centreline measurement.
- `grossCoveredArea` was already exact — it lands precisely on the outer face of the external walls
  — and is now described as built-up area.
- `groundCoveragePercent` and `openSiteArea` are ground-floor ratios by definition and no longer
  change with the floor being viewed. `coveragePercent` and `openArea` are retained as aliases and
  now agree with them instead of contradicting them.
- `floorAreaRatio` (FAR / FSI) is reported: total gross covered area over plot area.
- `projectBalconyArea` and `projectTerraceArea` count every floor; the existing floor-scoped fields
  are unchanged and documented as floor-scoped.
- `StairConnection` reports `riserHeightInches` and `treadDepthInches`, converted from the exact rise
  rather than the display-rounded feet value.
- A setback breach is now an **error**. A setback is a legal line; the plot edge is a drawing
  boundary, and treating the legal limit more softly was backwards.

## 3. Room anchors always land inside the room

`roomCentroid` returns the true area centroid, which for a U- or C-shaped polygon falls in the
notch — outside the room. It drove Walk Mode's spawn point, 3D camera focus, plan label placement,
and the element anchor for `measure_distance` and `focus_element`, so the shipped U-shape preset
spawned the walker inside a wall.

`roomInteriorPoint` now backs all four. It returns the centroid when that point is inside the room
and otherwise the centre of the room's largest interior band, reusing the existing orthogonal
interval sweep. `roomCentroid` remains exported for callers that genuinely want the area centroid.

## 4. Agents can reach every operation the human UI can

Five canonical operations existed and worked but were never exposed, leaving the agent strictly less
capable than the person beside it: `set_active_floor`, `rename_project`, `update_room`,
`delete_stairs`, and `delete_wall`. A sixth, `set_floor_height`, is new. All six are now tools, and a regression test asserts their
presence so the asymmetry cannot silently return. `delete_wall` still refuses canonical
room-boundary walls, which are controlled by their rooms.

## 5. Inspection results fit an agent's context budget

Chrome's WebMCP guidance budgets roughly 1,500 characters per tool result. The two tools the agent is
told to call first were far above it.

| Tool | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| `inspect_floor` (13-room floor) | 38,663 | 19,320 | 58% |
| `inspect_project` | 8,635 | 3,069 | 64% |

`inspect_floor` takes a `detail` parameter defaulting to `summary`. The summary keeps every stable
ID, dimension, and now both area measures per room, while dropping wall connectivity, deprecated
compatibility fields, stair layout polygons, and the full circulation graph. `detail: "full"` returns
the previous payload unchanged. Room `wallIds` were removed from the summary as pure duplication —
each wall already lists the rooms it bounds — and the result carries a hint saying so.

## 6. Geometry no longer drifts out of alignment

Two rooms meant to share a party wall but drawn a fraction of a foot apart produced **two separate
exterior walls** with a sliver between them — the cause of plans that look disconnected in 2D and
doubled in 3D. A 0.1 ft near miss gave 0 shared walls and 8 exterior walls where 1 and 6 were
intended, and 9 derived 3D wall volumes where 7 were correct.

`alignVertices` now latches every distinct edge coordinate onto nearby existing geometry within a
0.25 ft tolerance. The guide set is what an architect actually designs against: neighbouring room
edges, the plot boundary, the four setback lines, stair footprints, and free-standing wall ends.

- `create_room`, `create_polygon_room`, and `update_room_vertices` align their edges.
- `move_room` latches by translation only, so a move never resizes the room.
- `resize_room` and `set_exact_dimension` are **never** snapped — a stated dimension is exact.
- Whenever an alignment is applied, the operation result carries an `alignment` field with the
  requested and applied geometry and the tolerance. Nothing is silently approximated.

In the interactive plan the same guide set now drives room moves, resizes, vertex edits, and wall
drawing, with the existing on-canvas guide lines showing what an edge has latched onto.

Verified end to end by building a two-storey house through WebMCP with all sixteen coordinates
deliberately off by 0.02–0.12 ft: **13 shared party walls, 22 exterior walls, 0 near-duplicate wall
pairs.**

## 7. Rooms can touch but never overlap

Overlap was previously accepted at creation and only reported afterwards as `ROOM_OVERLAP`.
`assertNoRoomOverlap` now refuses the operation, naming the conflicting room and the overlap area,
on create, move, resize, and vertex editing. The check uses the existing polygon intersection sweep,
so interlocking L- and U-shaped rooms that merely share a boundary remain legal. A refused operation
leaves the project byte-identical.

## 8. Storey height is editable

`set_floor_height` was missing entirely: a floor's height could only be chosen at creation, and the
ground floor was fixed at 9 ft for the life of the project. Roadmap §7.4 required this.

Changing a storey height re-levels every floor above it, updates that floor's wall heights, and lets
each connected stair recompute its rise, riser count, and tread depth from the new elevations — a
stair left too short for a taller storey is reported rather than silently accepted. Heights outside
7–16 ft are refused, as is a reduction that would leave an existing opening taller than the storey.
The control sits in the Floors panel beside the storey list.

## Verification

- `npm run test:architecture` — pass, extended with habitability rules, interior-anchor coverage for
  all four room shapes, exact carpet-area cases, floor-independent coverage, stair units, edge
  alignment and sliver-free 3D volumes, exact-dimension preservation, overlap refusal on create and
  move, and storey-height re-levelling.
- `npm run test:webmcp` — pass, 57 tools, human/agent parity, overlap refusal, storey-height
  re-levelling, and a payload-size guard.
- `npm run lint` — pass.
- `npm run build` — pass, with the existing editor/Three.js chunk-size warning unchanged.

## Deliberate limits

- The habitability thresholds are residential concepts. Jurisdiction, occupancy, accessibility rules,
  and the adopted code always govern, and mechanical ventilation as an accepted alternative to an
  openable window is not modelled.
- Carpet area assumes uniform wall thickness per room; the project still uses a single 0.5 ft
  thickness for both exterior and interior walls, which remains a schematic simplification.
- No geometry kernel was changed. The area sweep, stair transforms, and topology rebuild were
  audited against independently computed ground truth and left untouched.
