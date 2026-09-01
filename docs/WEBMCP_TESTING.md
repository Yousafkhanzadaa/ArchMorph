# WebMCP testing and evaluation

This document separates deterministic application tests from native client testing. Passing the local harness proves the architectural operations and catalog shape; it does not by itself prove that a compatible browser discovered and invoked the page-scoped tools.

## Automated checks

Run:

```bash
npm run test:architecture
npm run test:webmcp
```

The architecture suite covers canonical geometry, topology, hosted openings, circulation, multi-floor straight/L/U stairs, stair approaches and wall clashes, polygon rooms, persistence, migration, and spatial collision data. The WebMCP suite checks catalog count and categories, unique/spec-compatible names, bounded top-level schemas, concise definitions, annotations, successful inspection and mutation, and non-destructive argument failure.

## Native client prerequisites

1. Use the current ChatGPT in-app browser or the Chrome version and flag specified by the official challenge instructions.
2. Open the public ArchMorph URL, not a source-code preview.
3. Confirm the production UI loads without `?debug=1`.
4. Confirm the client discovers 57 ArchMorph tools. Historical result rows below retain the exact tool counts observed at the time of each run (40 before the exterior-system expansion, 51 before the habitability release).
5. Record the client name, exact version/model when visible, date, and result below.

## Native smoke suite

Start from a new project unless the case says otherwise. Stable IDs must come from inspection results rather than being invented.

| ID | Prompt / action | Expected tool behavior | Required evidence |
| --- | --- | --- | --- |
| N01 | “Inspect this project and summarize the plot, floors, and current issues.” | `inspect_project` | Plot dimensions, stable floor IDs, metrics, validation count, and project version |
| N02 | “Inspect the active floor and its circulation.” | `inspect_floor` → `inspect_circulation` | Stable room/wall/opening IDs plus reachable/disconnected rooms |
| N03 | “Add a 12 by 14 ft living room inside the buildable envelope, then validate.” | Inspect first → `create_room` → `validate_layout` → `focus_element` | Created room ID/dimensions, new version, visible room, validation result |
| N04 | “Add a correctly hosted exterior window and set it to low-e glazing.” | Inspect room/walls → `add_window` → `set_window_properties` | Host wall ID, opening ID, SHGC/VT/U-factor, visible plan and 3D update |
| N05 | “Create an upper floor and a connected straight, quarter-turn L-shaped, or half-turn U-shaped stair, then verify circulation.” | `create_floor` → inspect → create aligned stair halls → `add_stairs` with `stairType` → `inspect_floor` → `inspect_circulation` → `validate_layout` | Source/target floor IDs, lower/upper entry roles, explicit flight/landing/route geometry, full-width approach evidence |
| N06 | “Show the result in 3D, focus the stair, and capture a snapshot.” | `switch_view` → `set_camera` or `focus_element` → `take_snapshot` | UI visibly changes; snapshot metadata identifies current project version |
| N07 | Supply a nonexistent wall ID to an opening command. | Opening tool fails without a mutation | Specific error; unchanged project version and element counts |
| N08 | Start a capture/export and cancel it if the client exposes cancellation. | Execution observes the abort signal where supported | Safe cancellation; no partial model mutation |
| N09 | Make a direct human edit, then ask the agent what changed. | Fresh inspection reads the human edit | Agent reports the updated shared state without reloading |
| N10 | Navigate away or close the page after discovery. | Registration signal cleanup removes page-scoped tools | Tools no longer remain available for the closed/navigated page |
| N11 | “Review this design the way an architect would, then fix what you find.” | `inspect_project` → `validate_layout` → `add_window` or `set_window_properties` → `validate_layout` | Habitability findings name the room, its shortfall, and the threshold; the correction clears the finding without new errors |

## Evaluation fixtures

[`../evals/webmcp-journeys.json`](../evals/webmcp-journeys.json) contains machine-readable purpose, selection, argument, sequence, failure, and collaboration cases. Placeholder IDs such as `<floor-id>` mean the agent must resolve the real value through inspection.

For each fixture, record:

- selected tool or tool sequence;
- arguments actually supplied;
- whether the expected visible state change occurred;
- result fields and project version;
- any unexpected tool selection, retry, or silent approximation; and
- pass/fail with a short note.

## Result log

| Date | Environment | Scope | Result | Notes |
| --- | --- | --- | --- | --- |
| 2026-08-29 | Local vinext build and debug harness | Catalog plus deterministic domain/tool execution | Pass | `test:architecture`, `test:webmcp`, lint, and production build completed successfully |
| 2026-08-29 | Codex in-app browser, localhost | UI load, fixture import, plan/3D/validation/debug views | Pass for UI; native discovery not claimed | Local page displayed 40-tool harness; native browser API availability must be checked on deployed origin |
| 2026-08-29 | ChatGPT desktop 26.814.41407 (build 6720), Codex in-app browser, public deployment | Public access, production UI, metadata, native prerequisite check | Blocked before N01; native discovery unavailable | The normal URL loaded without `?debug=1`, but `"modelContext" in document` was `false` and `typeof document.modelContext` was `"undefined"`; no Chrome browser was connected |
| 2026-08-29 | ChatGPT desktop 26.825.41651 (build 7345), Codex In-app Browser, public deployment | Native discovery and N01–N10 | Pass: N01–N07, N09–N10; N08 N/A | Native browser capability discovered exactly 40 page tools; client exposes timeout but no cancellation mechanism |
| 2026-08-30 | Codex In-app Browser, localhost | Native discovery plus editable site, roof/parapet, boundary/gate, balcony/railing, wall finish, façade features, and 3D render | Pass | Native capability discovered 51 tools; representative calls completed with no browser console errors; derived 3D detail remained bounded |
| — | Chrome WebMCP configuration, public deployment | N01–N10 | Not run | Optional second-client evidence; not required for the verified ChatGPT run |

## Initial blocked native attempt — 2026-08-29

- **Public URL:** `https://archmorph-studio.musfk.chatgpt.site/` (no query string and no debug harness)
- **Host application:** ChatGPT desktop 26.814.41407, build 6720
- **Browser surface reported by the client:** Codex In-app Browser
- **Native prerequisite:** unavailable — `"modelContext" in document === false` and `typeof document.modelContext === "undefined"`
- **Alternate permitted environment:** unavailable — the browser runtime reported `Browser is not available: chrome`, so Chrome 149+ with the WebMCP testing flag could not be selected
- **Outcome:** this older client could not begin N01. Updating the desktop client to 26.825.41651 removed this blocker.
- **Evidence:** the production editor itself loaded normally. Screenshot: [`assets/webmcp-native-production-2026-08-29.jpg`](assets/webmcp-native-production-2026-08-29.jpg).

## Completed native verification — 2026-08-29

- **Public URL:** `https://archmorph-studio.musfk.chatgpt.site/` with no query string or debug harness
- **Host application:** ChatGPT desktop 26.825.41651, build 7345
- **Browser surface:** Codex In-app Browser with native `webmcp` capability
- **Application source tested:** `934ce86c79111b7d8259d71d224a6163451581bd`, deployed as Sites version 9
- **Disposable project:** `WebMCP Native QA Final`; the pre-existing Gilgit projects and the earlier diagnostic project were preserved
- **Discovery result:** exactly 40 page-scoped ArchMorph tools
- **Direct page property:** `document.modelContext` remains hidden from page evaluation in this client. Native discovery is nevertheless available through the browser's mediated `webmcp` capability; the successful catalog and invocations below are native client results, not the debug harness.

Discovered names, in registration order:

```text
inspect_project, inspect_plot, inspect_floor, set_plot_orientation,
inspect_room, inspect_wall, inspect_opening, inspect_circulation,
create_room, create_polygon_room, move_room, resize_room,
update_room_vertices, delete_room, add_wall, move_wall, add_door,
add_window, update_opening, set_door_properties, rehost_door,
set_window_properties, rehost_window, set_exact_dimension,
delete_opening, add_stairs, update_stairs, set_exterior_finish,
create_floor, calculate_room_area, calculate_total_area,
calculate_open_area, measure_distance, validate_layout, switch_view,
set_camera, set_navigation_mode, focus_element, take_snapshot, export_plan
```

| ID | Prompt | Native tool sequence and supplied arguments | Returned result and version | Visible result | Outcome |
| --- | --- | --- | --- | --- | --- |
| N01 | Inspect this project and summarize its plot, floors, area metrics, and current validation issues. | `inspect_project({})` | `floor-ground`; 30 × 60 ft plot; 24 × 42 ft / 1,008 sq ft buildable envelope; zero issues; v2 → v2 | Empty disposable plot loaded | Pass |
| N02 | Inspect the active floor and analyze its entrance-to-room circulation. | `inspect_floor({floorId:"floor-ground"})` → `inspect_circulation({})` | Empty floor returned zero rooms/walls/openings and no invented IDs; no reachable or disconnected rooms; v2 → v2 | Empty active floor remained unchanged | Pass; expected empty-project result before N03 |
| N03 | Add a 12 by 14 ft living room inside the buildable envelope, validate the design, and focus the new room. | Inspect first → `create_room({floorId:"floor-ground",name:"Native QA Living",roomType:"Living Room",x:4,y:12,width:12,length:14})` → `validate_layout({})` → `focus_element({elementId:"room-eee8994e"})` | Room `room-eee8994e`, 168 sq ft; canonical wall IDs returned; validation reported `NO_ROOM_ACCESS` and `NO_EXTERIOR_ACCESS`; focus matched room; v2 → v4 | Room appeared and was focused in plan | Pass |
| N04 | Add a correctly hosted exterior window to the new room and set it to the low-e glazing preset. | `inspect_room({roomId:"room-eee8994e"})` → `inspect_wall({wallId:"wall-floor-ground-h-1200-400-1600"})` → `add_window({wallId:"wall-floor-ground-h-1200-400-1600",offset:6,width:4,height:4,sillHeight:3,windowType:"fixed",operable:false,glazing:"clear"})` → `set_window_properties({openingId:"window-09fc8493",glazing:"low-e"})` → `inspect_opening(...)` | Window `window-09fc8493` stayed on the inspected exterior wall and returned low-e SHGC 0.35, VT 0.62, U-factor 0.30; v4 → v6 | Window appeared in plan and 3D | Pass after fix |
| N05 | Create an upper floor, connect it with a valid straight stair, inspect circulation, and validate the layout. | `create_floor({name:"Native QA Upper",height:9})` → inspect → `create_room({floorId:"floor-4c32f5d3",name:"Native QA Upper Landing",roomType:"Storage",x:4,y:12,width:12,length:14})` → `add_stairs({floorId:"floor-ground",x:8,y:14,width:4,length:11,direction:"up",rotation:0})` → circulation/validation | Stair `stair-369b107f`; source `floor-ground`, target `floor-4c32f5d3`; rise 9 ft, 14 risers at 7.72 in, 10.15 in tread; real edge `room-eee8994e` → `room-1c899d07`; no invalid stair IDs or stair validation errors; v6 → v9 | Upper floor and connected stair appeared | Pass |
| N06 | Switch to 3D, focus the stair, and capture a snapshot. | `switch_view({mode:"3d"})` → `focus_element({elementId:"stair-369b107f"})` → `take_snapshot({download:false})` | 3D orbit/front-right, focused stair, `archmorph-3d-orbit-v11.png`, image/png, project v11; v9 → v11 | 3D UI showed one window and one stair; stair property panel showed the tested geometry | Pass; [native snapshot](assets/webmcp-native-final-n06-2026-08-29.png), [visible UI](assets/webmcp-native-final-n06-ui-2026-08-29.jpg) |
| N07 | Use a deliberately nonexistent wall ID with an opening command. | `add_window({wallId:"wall-does-not-exist",offset:4,width:3})` | Specific `Wall wall-does-not-exist does not exist.` error; v11 → v11; counts stayed 2 floors / 2 rooms / 8 walls / 1 window / 1 stair | No element appeared | Pass |
| N08 | Start a snapshot or export operation and cancel it if the client exposes cancellation. | Client surface inspected before starting output | Native tools expose `description` and `call`; `call` accepts `timeoutMs` only, with no cancel method, handle, or `AbortSignal`; v11 unchanged | No operation started; no partial mutation | N/A — client cancellation mechanism absent |
| N09 | Make a small direct human edit, then ask: “What changed in the current project?” | Human changed the visible Façade palette from Mineral stucco to Brick masonry → `inspect_project({})` | Fresh inspection returned exterior finish `brick`; v11 → v12 | 3D façade changed to brick immediately without reload | Pass |
| N10 | Record discovered tools, navigate away, and check whether ArchMorph tools remain available. | Recorded 40 names → navigated the same tab to `about:blank` → fetched page tools | Before: 40 ArchMorph tools. After: zero available tools; the client also refused invocation because no page origin existed. | ArchMorph page was gone | Pass |

The first native pass found one genuine ArchMorph defect: `set_window_properties({glazing:"low-e"})` changed the preset label but retained the previous clear-glass values. The canonical `update_opening` operation now applies the selected preset's performance defaults whenever no explicit override is supplied, so UI and WebMCP edits share the fix. Architecture and WebMCP regression suites cover the corrected 0.35 / 0.62 / 0.30 values. The N05 fixture was also corrected to require an aligned upper room or landing, because a newly created floor is intentionally empty and a valid circulation stair needs occupiable geometry on both floors.

After the fix, `npm run test:architecture`, `npm run test:webmcp`, `npm run lint`, and `npm run build` all completed successfully. The already implemented cancellation forwarding remains covered deterministically even though the tested native client does not expose a way to trigger cancellation.

## Failure discipline

- Never replace an invalid stable ID with a guessed visual target.
- Never silently clamp dimensions unless the tool schema or result explicitly documents it.
- A rejected mutation must leave the canonical project unchanged.
- Read-only tools must not create activity entries or increment the project version.
- Debug harness success must not be described as native WebMCP success.
