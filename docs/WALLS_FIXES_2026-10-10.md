# Wall workflow fixes · 10 October 2026

Implemented the findings in [the investigation](WALLS_INVESTIGATION_2026-10-09.md). Independent walls, room-generated boundaries, doors/windows, polygon rooms, stairs, finishes, and the visible floor-cutaway control remain available.

## Drawing and editing

- Continuous drawing is enabled by default: click successive corners or drag, then use Finish or close the chain. Disable Continuous walls for separate segments. Escape returns to Select.
- Both endpoints snap to exact existing endpoints and wall lines before grid and angle constraints. Fractional endpoints are retained. Lower-floor geometry also supplies alignment snaps when its reference is visible.
- Select an independent wall to drag either endpoint, edit start/end coordinates, length or thickness, or move it with arrows (0.5 ft; Shift gives 1 ft). Endpoint editing retains axis alignment from the fixed end; whole-wall dragging preserves its vector and fractional coordinates.
- Independent walls can receive a material override on both sides. Height follows the selected storey.
- Getting-started guidance no longer blocks placement or wall drawing on an empty plot.
- The focus effect uses a plot-space filter region, so selecting horizontal/vertical walls no longer clips their visible strokes.

## Model integrity and architectural operations

The shared operation pipeline rejects non-finite geometry, independent walls shorter than 1 ft, thickness outside 0.2–2 ft, exact/reversed duplicates, and endpoints outside the plot. Legacy invalid/duplicate walls receive findings. Short canonical boundary fragments remain valid. Connection metadata updates after additions, moves, endpoint edits and deletion, including endpoint-to-segment T-junctions. Hosted openings retain their identity and reject geometry changes atomically if they no longer fit.

Select a wall in a simple closed orthogonal enclosure to preview **Create room from enclosure**. Confirm the room name/type to create its room semantics, slab and derived roof. The conversion preserves physical wall IDs (including collinear segmented edges), thickness, finishes and valid openings, and removes the independent copies in one undoable operation. It accepts 4–12 segments without branches; overlaps or invalid boundaries reject the whole edit.

A full-span horizontal or vertical independent partition in a rectangular room exposes **Split room**. It creates two spaces and one shared boundary, preserving the original room ID and total area. Both resulting dimensions need at least 3 ft. Doors become semantic room-to-room connections. Finishes/openings survive when valid; an opening crossing a new corner rejects the edit. Partial partitions and arbitrary wall networks stay independent.

New WebMCP tools use the same operations: `update_wall`, `create_room_from_walls`, `split_room_with_wall`. All 58 existing studio tools remain, for a total of 61.

## Upper floors

The active storey's elevation is visible beside its selector. Plan has a default-on, non-selectable reference of the nearest lower floor, with a visible Show/Hide control. A banner explains the active elevation and provides a direct route to Checks when geometry extends beyond the modeled footprint below.

Checks compare upper rooms, independent walls and exterior slabs against the immediately lower room/wall footprint, subtracting stair voids. Polygon overlap accounts for unions, concave rooms and angled walls. Placement feedback points to missing geometry below.

Intentional overhangs remain possible and are flagged for review. This work does not invent columns, beams or foundations, move upper walls to ground level, or certify structural support. A footprint overlap alone is not a structural calculation. A new level remains a level record; independent wall loops create a slab only after explicit room conversion.

Underlays, endpoint handles and live drawing feedback stay out of SVG/PNG plan exports. Existing multi-floor 3D and cutaway behavior is retained.

## Verification

- Passed `test:walls`, `test:architecture`, `test:model`, `test:webmcp`, `test:studio`, TypeScript, ESLint, `git diff --check`, and production build.
- New wall regressions cover geometry rejection/atomicity, exact snapping, connectivity/T-junctions, hosted openings, material surfaces, segmented/reversed enclosure conversion, split-room area/ownership, Undo, migration, footprint unions, stair voids, and agent parity.
- Production browser testing used a synthetic **Wall Fixes QA** design on isolated `localhost:3002`. Confirmed a four-wall continuous chain in five clicks, exact fractional start snapping, endpoint dragging, arrow nudging, numeric rejection with field feedback, room preview/conversion, retained door/finish/IDs, Undo/Redo, room splitting with a shared door, upper elevation/reference toggle, warning banner and clean SVG export.
- Verified the visible 3D floor-cutaway control and retained upper room slab. Screenshots: [plan editing](verification/wall-fixes-plan.jpg), [cutaway](verification/wall-fixes-cutaway.jpg).
- Checked mobile at 390 × 844: no horizontal overflow; numeric controls, continuous drawing, lower-floor toggle and guidance remain accessible. Touch hardware was not tested.
- [Current diagnostic data](verification/walls-fixed-diagnostic-data.json) can be regenerated with `node --experimental-strip-types scripts/investigate-walls.ts`. [Original evidence](verification/walls-investigation-data.json) remains unchanged.
- Build retains existing bundle-size and vinext route-classification advisories. The previously observed vinext production RSC prefetch error is outside this wall work; no claim of a clean browser console is made.

No deployment, commit or push was performed. User designs on the original local server were not edited during browser QA.
