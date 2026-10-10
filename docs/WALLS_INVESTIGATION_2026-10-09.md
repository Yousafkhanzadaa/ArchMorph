# Wall placement and upper-floor investigation · 9 October 2026

**Update · 10 October:** The workflow and model fixes are implemented. See [implementation and verification notes](WALLS_FIXES_2026-10-10.md). The findings and screenshots below record the original behavior; the diagnostic script now verifies the corrected guards and produces [current output](verification/walls-fixed-diagnostic-data.json).

The reported floating geometry is reproducible. The renderer places walls and rooms at the correct storey elevation, but the editor allows upper-floor geometry above empty ground without explaining it or identifying the absence of modeled geometry below. Independent walls also have a much narrower editing workflow than rooms.

This is an investigation of the current working tree, including the earlier studio improvements. No application behavior was changed during this investigation. The only additions are this report, a repeatable diagnostic script, diagnostic output, and screenshots. All browser edits used a new synthetic **Wall Investigation QA** home on isolated `localhost:3002`.

## What causes the floating walls and rooms

1. A new upper floor is a **level record**, not a physical slab or a copy of the floor below. Above the default 9 ft ground storey, its elevation is 9 ft.
2. `add_wall` assigns the active floor ID and its height. The renderer adds that floor's elevation to the wall's base and top. A 9 ft upper-floor wall therefore occupies **9–18 ft above the ground datum**.
3. Placement checks do not compare an upper-floor footprint with geometry on lower floors. A room at `(4,35)` and a wall enclosure at `(20,35)` can therefore exist beside, rather than above, a lower room at `(4,10)`.
4. A room creates a local floor slab and boundary walls. The slab in the reproduced upper room spans **9–9.18 ft**. There is no modeled vertical support under that slab.
5. Four independent walls drawn into a rectangle remain four independent walls. They create **no room, floor slab, roof, or occupied area**. Checks returns **pass with zero findings** for this wall-only upper floor.

The correct response is to help the user understand and align levels. Automatically dropping upper walls to the ground would change their floor assignment and architectural intent. Automatically filling the void with rooms, columns, or foundations would invent design elements. A footprint comparison can flag missing modeled geometry below; it cannot establish structural adequacy. Legitimate overhangs, setbacks, terraces, and future structural layouts must remain possible.

Evidence: [manual wall enclosure above empty ground](verification/walls-upper-floor-investigation.jpg), [walls and room together](verification/walls-and-room-upper-floor-investigation.jpg), [cutaway showing the room slab and empty wall enclosure](verification/walls-and-room-upper-floor-cutaway.jpg).

Sources: `architecture.ts` `create_floor` at 2760, `add_wall` at 2400, `validateLayout` at 3002; `model-presentation.ts` `buildWallSurfaces` at 61, `buildFloorSlab` at 130, `buildRoofDeck` at 89; `ModelView.tsx` room-only slab generation at 429.

## Why adding and editing walls feels awkward

| Finding | Evidence and consequence | Priority |
|---|---|---|
| Every segment is a separate gesture | Two-click drawing works, but a four-wall rectangle needs eight clicks. Completion clears the start point instead of continuing from the last endpoint. | P1 |
| The start does not snap to existing geometry | The first point uses only the 0.5 ft grid. Endpoint/angle alignment runs on the moving end, not the start. Browser reproduction: existing `(4.25,25.25)` became new start `(4,25.5)`. The intended joint is about 0.35 ft apart. | P1 |
| End snapping can also lose precision | The moving end finds existing endpoints, then rounds the result back to the grid. Precise imported or agent-created endpoints can be displaced. The broad axis rule can also override a nearby endpoint. Confirmed by source inspection; not separately exercised in the browser. | P1 |
| No numeric wall editing | The wall inspector lists length, thickness, and height as read-only text. Independent walls can be translated by dragging, but have no endpoint handles or editable endpoint/length fields. Arrow-key nudges currently handle rooms and openings, not walls. | P1 |
| No lower-floor reference | Plan filters rooms and walls to the active floor. A new upper floor looks like an empty plot, with no underlay to align against. Floor height is absent from the active-floor control. | P1 |
| A closed loop has no room conversion | Closing walls does not classify a space or create its slab. There is no explicit “Create room from enclosure” action or explanation on completion. Automatic conversion would be inappropriate for some screens, fences, or courtyards. | P2 |
| Partitions do not divide room semantics | A wall dragged inside the upper room was accepted, retained `roomIds: []`, and left one room. A door in such a wall remains an independent-wall opening rather than a connection between two room nodes. | P2 |
| Wall material is constrained by room ownership | Independent walls always have `exterior: false`; the inspector offers a finish override only for exterior room-boundary walls. Independent screens cannot receive that override through the existing wall workflow. | P2 |

Sources: `FloorPlan.tsx` `toPoint` at 168, `alignWallPoint` at 229, `completeSpan` at 256, root drawing handler at 271; `Studio.tsx` wall inspector at 1978 and keyboard handler around 988.

## Model integrity gaps

The diagnostic script reproduced the following, without passing invalid geometry to the browser renderer:

| Finding | Observed result | Priority |
|---|---|---|
| Connection metadata is stale after wall edits | The four touching walls reported `[0,0,0,0]` connected neighbors. Migration/reload changed this to `[2,2,2,2]`. `add_wall`, `move_wall`, and independent-wall deletion do not recompute connectivity. | P1 |
| T-junctions are absent from connection metadata | A new wall ending halfway along another wall reports no connection even after migration. `connectWalls` recognizes endpoint-to-endpoint contacts only. This is distinct from rendered physical junctions. | P1 |
| Duplicate segments are accepted | Adding the same wall twice produced two model elements but one unioned 3D volume, with no finding. Selection and opening ownership can become ambiguous despite a clean-looking model. | P1 |
| A wall can collapse to zero length | Direct `move_wall` endpoint edits reduced a 10 ft wall to zero. Checks returned no issue and the spatial model emitted zero volumes, leaving an invisible model element. The current UI exposes translation only, so this is primarily a core-operation/import concern. | P1 |
| Wall thickness is not enforced in the core operation | `0`, `-0.5`, and `3` ft were accepted with no findings. The WebMCP schema declares 0.2–2 ft, but `add_wall` itself does not enforce that contract. A schema is insufficient protection for all callers and imports. | P1 |
| Non-finite wall coordinates are accepted by the core | Both NaN and Infinity were stored through direct operations. The tool number helper rejects NaN but does not reject Infinity. These diagnostic objects were not persisted or rendered. | P1 |
| Out-of-plot walls are permitted, then reported | Creation accepted a start at x = -2; validation correctly returned `WALL_OUTSIDE_PLOT`. Room creation instead rejects out-of-plot geometry immediately. This is a consistency decision, not a missing wall finding. | P2 |

Sources: `architecture.ts` `connectWalls` at 1538, `rebuildCanonicalTopology` at 1554, `migrateProject` at 1803, `add_wall` at 2400, `move_wall` at 2425, wall validation around 3253; `webmcp-tools.ts` number helpers around 74 and `add_wall` around 456.

## What already works and should be preserved

- Drag and two-click placement both worked on the active upper floor, including drawing over a room. Escape removed the pending start and returned to Select.
- Walls retained the chosen floor and rendered at its elevation. Migration retained all four independent walls. Raising the ground storey to 12 ft moved the upper level to 12 ft while retaining its 9 ft wall height.
- Browser Undo removed exactly the dragged partition: 11 active-floor walls became 10. Redo restored 11.
- Translating an independent wall retained its hosted door ID, host wall ID, and offset in the diagnostic fixture.
- Room-generated walls, shared boundaries, polygon rooms, doors/windows, multi-floor stairs, cutaway, finishes, and standalone walls remain separate architectural capabilities. Their existing regression suites passed.

## Recommended implementation sequence

1. **Harden the common operation pipeline.** Require finite endpoints and valid thickness; reject degenerate segments after creation and movement; handle exact/reversed duplicates deliberately. Update connectivity after wall additions, moves, and deletions, and define endpoint-to-segment T-junctions. Preserve host IDs and reject changes atomically when openings would become invalid. Add regression tests for these failures.
2. **Make wall drawing predictable.** Snap the start and end to exact existing geometry before applying the grid, preserving a chosen endpoint. Add a visible continuous-wall option, live length feedback, a “Finish” action, endpoint handles, and numeric geometry editing. Keep single segments, arbitrary angles, Undo, Escape, and independent walls available.
3. **Make upper-floor context visible.** Add an optional, non-selectable lower-floor underlay, useful alignment snaps, the active floor's elevation, and a concise explanation when creating an empty upper floor. The underlay must stay out of exported architectural drawings unless explicitly requested.
4. **Report missing modeled geometry below.** Compare room/wall footprints with the immediately lower level and identify uncovered portions as concept guidance. Include stairs/slab voids and relevant balconies/terraces; avoid implying a structural certification or automatically inventing support. Explain the issue at placement and in Checks, while allowing intentional exceptions.
5. **Add explicit enclosure/partition semantics later.** Preview “Create room from enclosure” before converting suitable wall loops. Preserve independent walls, openings, materials, geometry, and Undo in one transaction, avoiding duplicate room-boundary walls. True partition/split-room behavior needs its own bounded operation; it should not be silently inferred from every wall line.

## Verification and limits

Run the repeatable diagnosis with:

```sh
node --experimental-strip-types scripts/investigate-walls.ts
```

Saved output: [diagnostic data](verification/walls-investigation-data.json). The script asserts the correct elevation/retained-host behavior and records the gaps; it is not a passing regression suite endorsing those gaps.

Passed: `test:architecture`, `test:model`, `test:webmcp`, `test:studio`, TypeScript, ESLint, and `git diff --check`. These existing tests do not cover all findings above. A new build was unnecessary because application code was unchanged; browser checks used the production build verified in the previous cutaway task.

Browser reproduction used the default desktop viewport and synthetic saved projects only. Touch hardware was not tested. The known production vinext RSC prefetch setup error from the earlier task remains unrelated to the wall evidence and unresolved. No structural calculations, deployment, commit, or push were performed.
