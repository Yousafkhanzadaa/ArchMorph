# Studio audit fixes — 11 October 2026

ArchMorph loads again after exporting the existing `openingCenter` helper for the shared door geometry module. The fixes below address the [Sukoon House audit](SUKOON_HOUSE_STUDIO_AUDIT_2026-10-10.md). The completed house remains project `project-e1983050`, version 157: 27 rooms, 84 walls, 34 doors, 39 windows, one U-shaped stair, two outdoor slabs, and nine façade features. Native inspection now reports **zero errors and zero warnings**, with all 27 rooms reachable. This is a result of the implemented concept checks, not a construction approval.

## Bug status

| Audit ID | Result | Implementation and verification |
| --- | --- | --- |
| B01 | Fixed | Upper-base checks subtract the connected stair opening from the occupied upper slab as well as the lower footprint. The actual 86.25 sq ft Sukoon void no longer triggers an unsupported-base warning; regression cases still detect real overhangs. |
| B02 | Fixed | Walk collisions include enabled railing sides. Upper-floor movement requires a modeled room or outdoor slab. A sustained westward movement stops at x=6.44 ft inside the terrace's x=6 ft edge, at eye height 15.4 ft. |
| B03 | Fixed | Room/outdoor edits reject overlapping occupied slabs atomically. Imported duplicates produce validation errors; outdoor area uses a union per floor and kind, so an identical terrace is counted once at 280 sq ft. |
| B04 | Fixed | The canonical operation enforces 2–8 ft door width and 6–9 ft height through generic edits, specialized tools, exact dimensions, and the inspector. Invalid imported doors are flagged and excluded from circulation, including off-wall and wrong-floor hosts. These are concept-model limits. |
| B05 | Fixed | Mutation responses resolve room and other entity data against committed topology. Batch results use the final entities and the one committed version. Returned room wall IDs match the live model after resizing. |
| B06 | Application lifecycle fixed; client handles require refresh | Native registration waits for local project loading, uses a stable bridge to current state, supports explicit reconnection, and reports registration failures. After final reload, discovery found 63 tools and native inspection returned the original v157 house. Transient stale handles were observed while retaining older browser helper closures; refreshed document catalogs invoked directly worked. This does not establish behavior in every WebMCP client. |
| B07 | Fixed | Full floor inspection includes stairs connecting to that floor, matching summary semantics. Native upper-floor inspection contains the one U-shaped stair. |
| B08 | Core fix implemented | Doors can explicitly open into an adjacent room. Plan, 3D, minimap, and sweep checks share the direction. End-hinge SVG arcs are corrected. Explicit sweeps warn about intersecting walls and overlapping door sweeps. Legacy doors keep their recorded direction until a room is chosen; fixture and passage-zone clash checks remain future work. |
| B09 | Fixed | “Edit in plan” has an independent accessible name and tooltip, including when responsive styling hides its text. |
| B10 | Fixed | JSON, SVG, and PNG filenames use a sanitized project name; drawing/view files also identify their floor/view and version. Ground and upper SVG exports have different filenames. |
| B11 | Fixed within a bounded session log | Outputs retain full JSON. The developer view supports search, status filtering, and downloading its latest 500 calls as an audit JSON. The log remains session-local; it is not an unlimited persistent transcript. |

## Workflow status

| Audit ID | Result |
| --- | --- |
| L01 | Closed door leaves now remain closed in Walk and block movement. A nearby Open/Close action and E shortcut update the shared model. The closed main entry stopped at z=14.63 ft; opening preserved the pose, then allowed movement to z=8.11 ft outside. |
| L02 | Outdoor slabs appear as named Walk destinations, minimap geometry, and circulation nodes. Both Sukoon outdoor spaces are reachable. A ground porch door retains site access; an upper balcony door alone cannot invent ground access. |
| L03 | Camera tools accept project, floor, or selection scope. The default project scope clears an old element focus; floor framing excludes the site boundary. |
| L04 | Cutaway preserves the selected camera and pose. In the browser check, rear-view camera coordinates remained x=25, y=5.4, z=147.86 before and after toggling. |
| L05 | A split operation accepts names and types for both results. The partition inspector exposes the new room's type alongside its name. |
| L06 | Standalone SVG drawings number rooms and provide a full-name/type/dimension/area legend. They remove editing controls and hit targets, include a drawing background, and retain north-label sizing without the app stylesheet. Interactive whole-plot labels may still truncate; their full titles and exported legend provide the complete names. |
| L07 | Undo/Redo history is persisted locally with a 500,000-byte budget and bounded snapshots. A two-edit batch was undone, the page reloaded, and Redo restored both edits. Named checkpoint limits and full version comparison are unchanged. |
| L08 | Each tab keeps its own active project in session storage. Autosaving another home no longer switches this tab's reload destination. Existing save conflict checks remain. Cloud sharing and multi-user collaboration are future work. |
| L09 | Save links stay visible for 60 seconds and text-export object URLs for 120 seconds. Native JSON/SVG content and visible Save/Open preview links succeed. Automated download capture still times out in this embedded browser; successful filesystem download is **not verified**. |
| L10 | New `preview_changes` and `apply_changes` tools accept 1–50 design edits with an expected version and prior-step references such as `$1.room.id`. Preview leaves the live model unchanged. A failed step rejects the entire batch. Successful application creates one revision, one activity entry, and one Undo step. The current catalog contains 63 tools. |

## Verification

All six regression suites pass: architecture, WebMCP, model presentation, studio priorities, walls, and the new audit-fixes suite. TypeScript, ESLint, the production build, and whitespace checks pass. Build output retains vinext's existing informational route-classification notice.

The audit regression loads the actual [Sukoon fixture](../fixtures/sukoon-family-retreat.archmorph.json), plus isolated cases for rejected slab overlap, duplicate-area union, invalid doors, ground-porch access, outdoor reachability, full stair inspection, railing/support collisions, room-relative sweeps, committed wall IDs, batch rollback/reference mapping/version consistency, schema rejection, camera scopes, and per-tab persistence. Existing suites continue checking real overhangs, topology, save conflicts, quota/corrupt storage, staircase geometry, and opening host retention.

Browser mutation checks used the separate **Sukoon House — Fix Verification** copy (`project-f366f503`). The primary house's design geometry and version were preserved. Historical audit files retain their original observations.

Evidence:

- [Main house after reload](verification/sukoon-fixes/reload-verification.json)
- [Native batch, rejected inputs, and full upper-floor inspection](verification/sukoon-fixes/native-batch-and-errors.json)
- [Door poses and Undo/Redo verification](verification/sukoon-fixes/door-and-history-verification.json)
- [Terrace guard screenshot](verification/sukoon-fixes/walk-terrace-fixed.jpg)
- [Closed-door screenshot](verification/sukoon-fixes/walk-closed-door.jpg) and [opened-door passage](verification/sukoon-fixes/walk-open-door.jpg)
- [Ground-floor SVG](verification/sukoon-fixes/ground-floor-fixed.svg), [rendered drawing](verification/sukoon-fixes/ground-floor-fixed.png), and [upper-floor SVG](verification/sukoon-fixes/first-floor-fixed.svg)

## Follow-up: Walk pointer capture error

The reported `ModelView.handleSelectionPointerDown` error was still present after the initial audit pass. Its unconditional `setPointerCapture` call could throw `InvalidStateError` while pointer lock was active. The handler now skips capture on locked or disconnected elements and handles capture rejection without a script error. Window pointer listeners preserve drag-to-look when capture is unavailable. Pointer up, cancellation, lost capture, window blur, hidden-page transitions, and scene cleanup end the drag. Repeated clicks no longer request pointer lock when the canvas already owns it. Walk movement buttons use the same capture guard and stop on pointer leave if capture is unavailable.

`npm run test:pointer` covers locked/disconnected targets, forced `InvalidStateError` and `NotFoundError`, fallback movement, missing release, release failure, multiple pointers, reentrant lost capture, and lock transitions. Model tests, TypeScript, lint, production build, and whitespace checks passed. Live browser checks passed for repeated clicks, drag look, release outside the canvas, movement-button hold/release, and dragging after reload, with no new console errors. The embedded browser refuses pointer lock, so its active-lock path was verified through the regression suite rather than a live locked session. The main Sukoon design remains at version 157.

Evidence: [browser verification](verification/sukoon-fixes/pointer-capture-verification.json) and [Walk screenshot](verification/sukoon-fixes/pointer-capture-fixed.jpg).

## Follow-up: mouse look interrupted by doors and floor changes

Door edits and active-floor changes rebuilt the renderer and its cleanup explicitly exited pointer lock. The same scene effect recreated held movement keys. Mouse lock and held keys now belong to a separate Walk-session effect that ends only when leaving Walk, changing projects, or unmounting the viewer. Door and floor rebuilds keep the same canvas and held-key set. Renderer cleanup saves the latest camera pose without overwriting a pending stair arrival. Escape, browser-driven lock loss, blur, and hidden-page transitions clear movement; scene/session effects never request a new lock after the user releases it. Door buttons and both manual floor selectors return keyboard focus to the canvas in Walk.

`npm run test:walk` executes the production session callback, renderer cleanup, mouse handlers and key-release logic with browser/GPU doubles, replaying effect dependency changes. It checks eight door toggles, manual and stair floor transitions, held movement, latest look, pending arrival, Escape/unlock, blur, mode/project changes and unmount. The pre-fix source fails this regression. Pointer/model suites, TypeScript, lint, production build and whitespace checks pass.

Live checks on the separate verification project preserved the camera pose through close-button and E reopening actions. Canvas focus remained active. Selecting First Floor returned canvas focus and W immediately moved from z=21 to z=23 without another click. There were no new console errors. The embedded browser refuses pointer lock, so active-lock retention was tested with browser doubles rather than a live locked session. The primary Sukoon design remains unchanged; the verification copy is version 9 after the two door toggles.

Evidence: [browser verification](verification/sukoon-fixes/walk-session-verification.json) and [Walk screenshot](verification/sukoon-fixes/walk-session-fixed.jpg).

## Remaining product work

The broader capability limits in the original audit remain a development backlog: furniture and fixtures, measured passage clearances, additional door/roof/stair types, terrain and irregular sites, metric input, climate studies, structural/service assemblies, cost/specification workflows, coordinated architect sheets, CAD/BIM exchange, cloud sharing, and design comparison. This fix pass does not claim those features are implemented. Door-sweep warnings currently require an explicit room reference and do not include furniture or evacuation zones. Walk protects modeled surfaces; it does not simulate falls or certify guard safety.
